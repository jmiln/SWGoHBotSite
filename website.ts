// Native Node Imports & Express Session
import crypto from "node:crypto";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import MongoStore from "connect-mongo";
import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import session from "express-session";
import helmet from "helmet";
// Local modules
import * as auth from "./modules/auth.ts";
import * as botApi from "./modules/botApi.ts";
import * as commandService from "./modules/commandService.ts";
import { connectDB } from "./modules/db.ts";
import { env } from "./modules/env.ts";
import { getGuildConfig, getGuildConfigs } from "./modules/guilds.ts";
import { formatPayoutTimes } from "./modules/payout.ts";
import { getUnitNames } from "./modules/units.ts";
import { getUser } from "./modules/users.ts";

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Trust proxy: nginx on loopback + private networks (Cloudflare → nginx → Express)
// More secure than 'true' - prevents IP spoofing for rate limiting
app.set("trust proxy", "loopback, linklocal, uniquelocal");

const initSite = async (): Promise<void> => {
    // HTTPS redirect middleware (only in production)
    app.use((req: Request, res: Response, next: NextFunction) => {
        if (env.NODE_ENV === "production") {
            // Check if request came through HTTPS (from Cloudflare/nginx)
            const proto = Array.isArray(req.headers["x-forwarded-proto"])
                ? req.headers["x-forwarded-proto"][0]
                : req.headers["x-forwarded-proto"];

            if (proto !== "https") {
                // Sanitize URL to prevent open redirect attacks (ensure single leading slash)
                const url = req.url.replace(/^\/+/, "/");
                return res.redirect(301, `https://${req.hostname}${url}`);
            }
        }
        next();
    });

    // Generate a fresh nonce for every request — used in CSP header and script tags
    app.use((_req: Request, res: Response, next: NextFunction) => {
        res.locals.nonce = crypto.randomBytes(16).toString("base64");
        next();
    });

    // Security headers with helmet
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: [
                        "'self'",
                        "https://code.jquery.com",
                        "https://cdnjs.cloudflare.com",
                        "https://static.cloudflareinsights.com",
                        (_req: unknown, res: unknown) => `'nonce-${(res as Response).locals.nonce as string}'`,
                    ],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                    imgSrc: ["'self'", "https:", "data:"],
                    connectSrc: ["'self'"],
                    fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                },
            },
            crossOriginEmbedderPolicy: false,
        }),
    );

    // Add Permissions-Policy header (not included in helmet by default)
    app.use((_req: Request, res: Response, next: NextFunction) => {
        res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=()");
        next();
    });

    // Serve static files first (no rate limiting needed for CDN-cached assets)
    const publicDir = path.join(__dirname, "/public");
    app.use(express.static(publicDir));

    // Session middleware (must come after static files, before routes)
    app.use(
        session({
            store: MongoStore.create({ mongoUrl: env.MONGODB_URI }),
            secret: env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false,
            cookie: {
                httpOnly: true,
                secure: env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            },
        }),
    );

    // Expose session user and current path to all EJS templates
    app.use((req: Request, res: Response, next: NextFunction) => {
        res.locals.user = req.session.user ?? null;
        res.locals.currentPath = req.path;
        next();
    });

    // Rate limiting middleware
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per windowMs per IP
        standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
        legacyHeaders: false, // Disable `X-RateLimit-*` headers
        message: "Too many requests from this IP, please try again later.",
    });

    app.use(limiter);

    // Add EJS helpers
    app.locals.formatPayoutTimes = formatPayoutTimes;
    app.locals.escapeAttr = (str: string): string => {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    };

    // Initialize command service cache
    console.log("Loading bot command data...");
    commandService.initialize();

    await connectDB();
    console.log("Connected to bot database.");

    // Not used anymore, but could be in the future? (Could probably have the bot save these to a file every hour or something?)
    // let guildCount = await parseInt(fs.readFileSync(path.join(__dirname, path.sep + "/data/guildCount.txt")));
    // setInterval(async () => {
    //     guildCount = await parseInt(fs.readFileSync(path.join(__dirname, path.sep + "/data/guildCount.txt")));
    // }, 5 * 60 * 1000);

    // Set the directory for the views and stuff
    app.set("views", __dirname);

    // Set the view engine to ejs
    app.set("view engine", "ejs");

    // Index page
    app.get("/", (_req: Request, res: Response) => {
        res.render("pages/index", {
            title: "SWGoHBot - Discord Bot for Star Wars Galaxy of Heroes",
            description:
                "SWGoHBot brings character stats, guild management, arena tracking, and more to your Discord server. Active on over 10,000 servers.",
        });
    });

    // About page
    app.get("/about", (_req: Request, res: Response) => {
        res.render("pages/about", {
            title: "About SWGoHBot",
            description:
                "Learn about SWGoHBot, a Discord bot for Star Wars Galaxy of Heroes with character stats, guild management, and more.",
        });
    });

    // ToS page
    app.get("/tos", (_req: Request, res: Response) => {
        res.render("pages/tos");
    });

    // Privacy Policy page
    app.get("/privacyPolicy", (_req: Request, res: Response) => {
        res.render("pages/privacyPolicy");
    });

    // FAQs page
    app.get("/faqs", (_req: Request, res: Response) => {
        res.render("pages/faqs");
    });

    // Commands page - dynamic from bot data
    app.get("/commands", (_req: Request, res: Response) => {
        const commandData = commandService.getCommands();
        res.render("pages/commands", { commandData });
    });

    // The link to invite the bot
    app.get("/invite", (_req: Request, res: Response) => {
        res.redirect(
            "https://discord.com/api/oauth2/authorize?client_id=315739499932024834&permissions=277025901632&scope=bot%20applications.commands",
        );
    });

    // The link to join the support server
    app.get("/server", (_req: Request, res: Response) => {
        res.redirect("https://discord.gg/FfwGvhr");
    });

    // Discord OAuth2 login — generate state, save to session, redirect to Discord
    app.get("/login", (req: Request, res: Response) => {
        const state = crypto.randomBytes(16).toString("hex");
        req.session.oauthState = state;
        const rawReturnTo = req.query.returnTo as string;
        req.session.returnTo = rawReturnTo?.startsWith("/") && !rawReturnTo.startsWith("//") ? rawReturnTo : "/dashboard";
        res.redirect(auth.buildDiscordAuthURL(state));
    });

    // Discord OAuth2 callback — verify state, exchange code, fetch user, store in session
    app.get("/callback", async (req: Request, res: Response) => {
        const code = req.query.code as string | undefined;
        const state = req.query.state as string | undefined;

        // CSRF check
        if (!state || state !== req.session.oauthState) {
            return res.status(403).render("pages/500", {
                title: "Forbidden - SWGoHBot",
                description: "Invalid OAuth state. Please try logging in again.",
            });
        }
        delete req.session.oauthState;

        if (!code) {
            return res.redirect("/");
        }

        try {
            const { accessToken } = await auth.exchangeCodeForToken(code);
            const discordUser = await auth.fetchDiscordUser(accessToken);
            // Save returnTo before regenerating session (regenerate clears session data)
            const returnTo = req.session.returnTo ?? "/dashboard";
            // Regenerate session ID to prevent session fixation attacks
            await new Promise<void>((resolve, reject) => {
                req.session.regenerate((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            req.session.user = {
                id: discordUser.id,
                username: discordUser.username,
                avatar: discordUser.avatar,
            };
            req.session.accessToken = accessToken;
            // Explicitly save before redirecting — after regenerate(), the new session
            // is not guaranteed to flush to MongoDB before the client follows the redirect.
            await new Promise<void>((resolve, reject) => {
                req.session.save((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            res.redirect(returnTo);
        } catch (err) {
            console.error("OAuth callback error:", err);
            res.redirect("/");
        }
    });

    // Logout — destroy session and redirect home (POST to prevent CSRF logout)
    app.post("/logout", (req: Request, res: Response) => {
        req.session.destroy(() => {
            res.redirect("/");
        });
    });

    // Dashboard — requires login
    app.get("/dashboard", async (req: Request, res: Response) => {
        if (!req.session.user) {
            req.session.returnTo = "/dashboard";
            return res.redirect("/login");
        }

        const user = req.session.user;
        const userConfig = await getUser(user.id);

        if (userConfig?.accounts) {
            userConfig.accounts.sort((a: { name: string }, b: { name: string }) =>
                a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
            );
        }
        if (userConfig?.arenaWatch?.allycodes) {
            userConfig.arenaWatch.allycodes.sort((a: { name: string }, b: { name: string }) =>
                a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
            );
        }

        res.render("pages/dashboard", {
            title: "Dashboard - SWGoHBot",
            description: "Your SWGoHBot dashboard.",
            user,
            userConfig,
        });
    });

    // Helper: check if a user can access a guild's config
    // Allows MANAGE_GUILD (bit 32) or a role in adminRole list
    async function canAccessGuild(
        accessToken: string,
        guildId: string,
        discordPermissions: string,
        adminRoles: string[],
    ): Promise<boolean> {
        if (BigInt(discordPermissions) & 32n) return true;
        try {
            const member = await auth.fetchGuildMember(accessToken, guildId);
            return member.roles.some((r) => adminRoles.includes(r));
        } catch {
            return false;
        }
    }

    // Guild Select — list servers the user can manage
    app.get("/guild-select", async (req: Request, res: Response) => {
        if (!req.session.user || !req.session.accessToken) {
            req.session.returnTo = "/guild-select";
            return res.redirect("/login");
        }

        const user = req.session.user;
        const accessToken = req.session.accessToken;

        try {
            const guilds = await auth.fetchUserGuilds(accessToken);
            const guildIds = guilds.map((g) => g.id);
            const configs = await getGuildConfigs(guildIds);

            // Build lookup maps
            const guildMap = new Map(guilds.map((g) => [g.id, g]));
            const configMap = new Map(configs.map((c) => [c.guildId, c]));

            type AccessibleGuild = { guild: auth.DiscordGuild; config: Awaited<ReturnType<typeof getGuildConfig>> };
            const accessibleGuilds: AccessibleGuild[] = [];

            // Path 1: guilds that have a DB config — check MANAGE_GUILD or adminRole
            for (const config of configs) {
                const guild = guildMap.get(config.guildId);
                if (!guild) continue;
                const adminRoles = config.settings?.adminRole ?? [];
                const allowed = await canAccessGuild(accessToken, config.guildId, guild.permissions, adminRoles);
                if (allowed) {
                    accessibleGuilds.push({ guild, config });
                }
            }

            // Path 2: guilds with MANAGE_GUILD but no DB config — check if bot is present
            const managedWithoutConfig = guilds.filter((g) => BigInt(g.permissions) & 32n && !configMap.has(g.id));
            const botChecks = await Promise.all(
                managedWithoutConfig.map((g) => botApi.isBotInGuild(g.id).then((inGuild) => ({ guild: g, inGuild }))),
            );
            for (const { guild, inGuild } of botChecks) {
                if (inGuild) {
                    accessibleGuilds.push({ guild, config: null });
                }
            }

            res.render("pages/guild-select", {
                title: "Server Config — SWGoHBot",
                description: "Select a server to view its SWGoHBot configuration.",
                user,
                accessibleGuilds,
            });
        } catch (err: unknown) {
            if (err instanceof Error && err.message.includes("401")) {
                req.session.returnTo = "/guild-select";
                return res.redirect("/login");
            }
            console.error("Guild select error:", err);
            res.status(500).render("pages/500", {
                title: "Server Error — SWGoHBot",
                description: "Something went wrong loading your servers.",
            });
        }
    });

    // Guild Config — view config for a specific server
    app.get("/guild/:id", async (req: Request, res: Response) => {
        if (!req.session.user || !req.session.accessToken) {
            req.session.returnTo = `/guild/${req.params.id}`;
            return res.redirect("/login");
        }

        const user = req.session.user;
        const accessToken = req.session.accessToken;
        const guildId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        try {
            // Fetch user's guilds and config in parallel
            const [config, guilds] = await Promise.all([getGuildConfig(guildId), auth.fetchUserGuilds(accessToken)]);

            const guild = guilds.find((g) => g.id === guildId);

            if (!guild) {
                return res.status(403).render("pages/500", {
                    title: "Access Denied — SWGoHBot",
                    description: "You do not have access to this server's configuration.",
                });
            }

            // Access check: MANAGE_GUILD or adminRole (from config if present)
            const adminRoles = config?.settings?.adminRole ?? [];
            const allowed = await canAccessGuild(accessToken, guildId, guild.permissions, adminRoles);

            if (!allowed) {
                return res.status(403).render("pages/500", {
                    title: "Access Denied — SWGoHBot",
                    description: "You do not have access to this server's configuration.",
                });
            }

            if (!config) {
                return res.render("pages/guild-config", {
                    title: `${guild.name} Config — SWGoHBot`,
                    description: `SWGoHBot configuration for ${guild.name}.`,
                    user,
                    guild,
                    config: null,
                    roleMap: {},
                    channelMap: {},
                    unitNameMap: {},
                });
            }

            // Collect all defIds from twList and aliases for a single bulk DB lookup
            const twDefIds = [
                ...(config.settings?.twList?.light ?? []),
                ...(config.settings?.twList?.dark ?? []),
                ...Object.values(config.settings?.aliases ?? {}),
            ];

            const [roles, channels, unitNameMap] = await Promise.all([
                botApi.fetchGuildRoles(guildId),
                botApi.fetchGuildChannels(guildId),
                getUnitNames(twDefIds),
            ]);

            const roleMap: Record<string, string> = Object.fromEntries(roles.map((r) => [r.id, r.name]));
            const channelMap: Record<string, string> = Object.fromEntries(channels.map((c) => [c.id, c.name]));

            res.render("pages/guild-config", {
                title: `${guild.name} Config — SWGoHBot`,
                description: `SWGoHBot configuration for ${guild.name}.`,
                user,
                guild,
                config,
                roleMap,
                channelMap,
                unitNameMap,
            });
        } catch (err: unknown) {
            if (err instanceof Error && err.message.includes("401")) {
                req.session.returnTo = `/guild/${guildId}`;
                return res.redirect("/login");
            }
            console.error("Guild config error:", err);
            res.status(500).render("pages/500", {
                title: "Server Error — SWGoHBot",
                description: "Something went wrong loading this server's configuration.",
            });
        }
    });

    // 404 handler - MUST come before error handler
    app.use((_req: Request, res: Response) => {
        res.status(404).render("pages/404", {
            title: "Page Not Found - SWGoHBot",
            description: "The page you're looking for doesn't exist.",
        });
    });

    // Error handler - MUST be last
    const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
        // Only log stack traces in development
        if (env.NODE_ENV !== "production") {
            console.error(err.stack);
        } else {
            // In production, log only the message
            console.error(`Error: ${err.message}`);
        }

        res.status(500).render("pages/500", {
            title: "Server Error - SWGoHBot",
            description: "Something went wrong on our end.",
        });
    };
    app.use(errorHandler);

    // Turn the site on
    const port = Number.parseInt(env.PORT, 10);
    app.listen(port, () => {
        console.log(`Site listening on port ${port}!`);
    });
};

initSite();
