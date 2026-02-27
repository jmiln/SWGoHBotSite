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
import { generateCsrfToken, verifyCsrfToken } from "./modules/csrf.ts";
import { connectDB } from "./modules/db.ts";
import { env } from "./modules/env.ts";
import { getGuildConfig, getGuildConfigs } from "./modules/guilds.ts";
import { formatPayoutTimes } from "./modules/payout.ts";
import { getUnitNames } from "./modules/units.ts";
import { getUser, updateUser } from "./modules/users.ts";

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

    // Parse URL-encoded form bodies (for POST form submissions)
    app.use(express.urlencoded({ extended: false }));

    // Flash message middleware: expose flash to templates then clear it
    app.use((req: Request, res: Response, next: NextFunction) => {
        res.locals.flash = req.session.flash ?? null;
        delete req.session.flash;
        next();
    });

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
        req.session.returnTo = rawReturnTo?.startsWith("/") && !rawReturnTo.startsWith("//") ? rawReturnTo : "/config";
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

    // Legacy redirect: /dashboard → /config
    app.get("/dashboard", (_req: Request, res: Response) => {
        res.redirect(301, "/config");
    });

    // My Config page — requires login
    app.get("/config", async (req: Request, res: Response) => {
        if (!req.session.user) {
            req.session.returnTo = "/config";
            return res.redirect("/login");
        }

        const user = req.session.user;
        const userConfig = await getUser(user.id);

        if (userConfig?.accounts) {
            userConfig.accounts.sort((a: { name: string }, b: { name: string }) =>
                a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
            );
        }
        if (userConfig?.arenaWatch?.allyCodes) {
            userConfig.arenaWatch.allyCodes.sort((a: { name: string }, b: { name: string }) =>
                a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
            );
        }

        const isPatreon = (userConfig?.patreonAmountCents ?? 0) > 0;

        res.render("pages/config", {
            title: "My Config — SWGoHBot",
            description: "Your SWGoHBot configuration.",
            user,
            userConfig,
            isPatreon,
        });
    });

    // GET /config/edit/lang — edit language settings
    app.get("/config/edit/lang", async (req: Request, res: Response) => {
        if (!req.session.user) {
            req.session.returnTo = "/config/edit/lang";
            return res.redirect("/login");
        }
        const user = req.session.user;
        const userConfig = await getUser(user.id);
        const csrfToken = generateCsrfToken(req);
        res.render("pages/config-edit-lang", {
            title: "Edit Language Settings — SWGoHBot",
            description: "Edit your SWGoHBot language settings.",
            user,
            userConfig,
            csrfToken,
        });
    });

    // POST /config/lang — save language settings
    app.post("/config/lang", async (req: Request, res: Response) => {
        if (!req.session.user) return res.redirect("/login");
        if (!verifyCsrfToken(req)) return res.status(403).send("Forbidden");

        const user = req.session.user;
        try {
            const userConfig = await getUser(user.id);
            if (!userConfig) {
                req.session.flash = { type: "error", message: "Config not found." };
                return res.redirect("/config");
            }

            const VALID_LANGUAGES = ["en_US", "de_DE", "es_SP", "ko_KR", "pt_BR"];
            const VALID_SWGOH_LANGUAGES = [
                "ENG_US",
                "GER_DE",
                "SPA_XM",
                "FRE_FR",
                "RUS_RU",
                "POR_BR",
                "KOR_KR",
                "ITA_IT",
                "TUR_TR",
                "CHS_CN",
                "CHT_CN",
                "IND_ID",
                "JPN_JP",
                "THA_TH",
            ];

            const language = req.body.language as string | undefined;
            const swgohLanguage = req.body.swgohLanguage as string | undefined;

            if (language !== undefined && language !== "" && !VALID_LANGUAGES.includes(language)) {
                req.session.flash = { type: "error", message: "Invalid bot language selected." };
                return res.redirect("/config/edit/lang");
            }
            if (swgohLanguage !== undefined && swgohLanguage !== "" && !VALID_SWGOH_LANGUAGES.includes(swgohLanguage)) {
                req.session.flash = { type: "error", message: "Invalid SWGoH language selected." };
                return res.redirect("/config/edit/lang");
            }

            await updateUser(user.id, {
                lang: {
                    language: language || undefined,
                    swgohLanguage: swgohLanguage || undefined,
                },
            });

            req.session.flash = { type: "success", message: "Language settings saved." };
            res.redirect("/config");
        } catch (err) {
            console.error("Config update error (lang):", err);
            req.session.flash = { type: "error", message: "Failed to save settings. Please try again." };
            res.redirect("/config");
        }
    });

    // GET /config/edit/arena-alert — edit arena alert settings (Patreon required)
    app.get("/config/edit/arena-alert", async (req: Request, res: Response) => {
        if (!req.session.user) {
            req.session.returnTo = "/config/edit/arena-alert";
            return res.redirect("/login");
        }
        const user = req.session.user;
        const userConfig = await getUser(user.id);
        const isPatreon = (userConfig?.patreonAmountCents ?? 0) > 0;
        if (!isPatreon) {
            req.session.flash = { type: "error", message: "This feature requires an active Patreon subscription." };
            return res.redirect("/config");
        }
        const csrfToken = generateCsrfToken(req);
        res.render("pages/config-edit-arena-alert", {
            title: "Edit Arena Alert Settings — SWGoHBot",
            description: "Edit your SWGoHBot arena alert settings.",
            user,
            userConfig,
            csrfToken,
        });
    });

    // POST /config/arena-alert — save arena alert settings (Patreon required)
    app.post("/config/arena-alert", async (req: Request, res: Response) => {
        if (!req.session.user) return res.redirect("/login");
        if (!verifyCsrfToken(req)) return res.status(403).send("Forbidden");

        const user = req.session.user;
        try {
            const userConfig = await getUser(user.id);
            if (!userConfig) {
                req.session.flash = { type: "error", message: "Config not found." };
                return res.redirect("/config");
            }
            if ((userConfig.patreonAmountCents ?? 0) <= 0) {
                return res.status(403).send("Forbidden");
            }

            const VALID_RANK_DMS = ["all", "primary", "off"];
            const VALID_ARENA = ["char", "fleet", "both", "none"];

            const enableRankDMs = req.body.enableRankDMs as string | undefined;
            const arena = req.body.arena as string | undefined;
            const payoutWarningRaw = req.body.payoutWarning as string | undefined;
            const enablePayoutResult = req.body.enablePayoutResult === "on";

            if (enableRankDMs && !VALID_RANK_DMS.includes(enableRankDMs)) {
                req.session.flash = { type: "error", message: "Invalid rank DMs value." };
                return res.redirect("/config/edit/arena-alert");
            }
            if (arena && !VALID_ARENA.includes(arena)) {
                req.session.flash = { type: "error", message: "Invalid arena type selected." };
                return res.redirect("/config/edit/arena-alert");
            }

            const payoutWarning = payoutWarningRaw !== undefined ? Number.parseInt(payoutWarningRaw, 10) : undefined;
            if (payoutWarning !== undefined && (Number.isNaN(payoutWarning) || payoutWarning < 0 || payoutWarning > 60)) {
                req.session.flash = { type: "error", message: "Payout warning must be between 0 and 60 minutes." };
                return res.redirect("/config/edit/arena-alert");
            }

            await updateUser(user.id, {
                arenaAlert: {
                    enableRankDMs: enableRankDMs ?? userConfig.arenaAlert?.enableRankDMs ?? "off",
                    arena: arena ?? userConfig.arenaAlert?.arena ?? "both",
                    payoutWarning: payoutWarning ?? userConfig.arenaAlert?.payoutWarning ?? 0,
                    enablePayoutResult,
                },
            });

            req.session.flash = { type: "success", message: "Arena alert settings saved." };
            res.redirect("/config");
        } catch (err) {
            console.error("Config update error (arena-alert):", err);
            req.session.flash = { type: "error", message: "Failed to save settings. Please try again." };
            res.redirect("/config");
        }
    });

    // GET /config/edit/arena-watch — edit arena watch settings (Patreon required)
    app.get("/config/edit/arena-watch", async (req: Request, res: Response) => {
        if (!req.session.user) {
            req.session.returnTo = "/config/edit/arena-watch";
            return res.redirect("/login");
        }
        const user = req.session.user;
        const userConfig = await getUser(user.id);
        const isPatreon = (userConfig?.patreonAmountCents ?? 0) > 0;
        if (!isPatreon) {
            req.session.flash = { type: "error", message: "This feature requires an active Patreon subscription." };
            return res.redirect("/config");
        }
        const csrfToken = generateCsrfToken(req);
        res.render("pages/config-edit-arena-watch", {
            title: "Edit Arena Watch Settings — SWGoHBot",
            description: "Edit your SWGoHBot arena watch settings.",
            user,
            userConfig,
            csrfToken,
        });
    });

    // POST /config/arena-watch — save arena watch settings (Patreon required)
    app.post("/config/arena-watch", async (req: Request, res: Response) => {
        if (!req.session.user) return res.redirect("/login");
        if (!verifyCsrfToken(req)) return res.status(403).send("Forbidden");

        const user = req.session.user;
        try {
            const userConfig = await getUser(user.id);
            if (!userConfig) {
                req.session.flash = { type: "error", message: "Config not found." };
                return res.redirect("/config");
            }
            if ((userConfig.patreonAmountCents ?? 0) <= 0) {
                return res.status(403).send("Forbidden");
            }

            const VALID_REPORT = ["climb", "drop", "both"];

            const enabled = req.body.enabled === "on";
            const report = req.body.report as string | undefined;
            const showvs = req.body.showvs === "on";

            if (report && !VALID_REPORT.includes(report)) {
                req.session.flash = { type: "error", message: "Invalid report style selected." };
                return res.redirect("/config/edit/arena-watch");
            }

            await updateUser(user.id, {
                arenaWatch: {
                    enabled,
                    allyCodes: userConfig.arenaWatch?.allyCodes ?? [],
                    report: report ?? userConfig.arenaWatch?.report ?? "both",
                    showvs,
                },
            });

            req.session.flash = { type: "success", message: "Arena watch settings saved." };
            res.redirect("/config");
        } catch (err) {
            console.error("Config update error (arena-watch):", err);
            req.session.flash = { type: "error", message: "Failed to save settings. Please try again." };
            res.redirect("/config");
        }
    });

    // GET /config/edit/guild-update — edit guild update settings (Patreon required)
    app.get("/config/edit/guild-update", async (req: Request, res: Response) => {
        if (!req.session.user) {
            req.session.returnTo = "/config/edit/guild-update";
            return res.redirect("/login");
        }
        const user = req.session.user;
        const userConfig = await getUser(user.id);
        const isPatreon = (userConfig?.patreonAmountCents ?? 0) > 0;
        if (!isPatreon) {
            req.session.flash = { type: "error", message: "This feature requires an active Patreon subscription." };
            return res.redirect("/config");
        }
        const csrfToken = generateCsrfToken(req);
        res.render("pages/config-edit-guild-update", {
            title: "Edit Guild Update Settings — SWGoHBot",
            description: "Edit your SWGoHBot guild update settings.",
            user,
            userConfig,
            csrfToken,
        });
    });

    // POST /config/guild-update — save guild update settings (Patreon required)
    app.post("/config/guild-update", async (req: Request, res: Response) => {
        if (!req.session.user) return res.redirect("/login");
        if (!verifyCsrfToken(req)) return res.status(403).send("Forbidden");

        const user = req.session.user;
        try {
            const userConfig = await getUser(user.id);
            if (!userConfig) {
                req.session.flash = { type: "error", message: "Config not found." };
                return res.redirect("/config");
            }
            if ((userConfig.patreonAmountCents ?? 0) <= 0) {
                return res.status(403).send("Forbidden");
            }

            const enabled = req.body.enabled === "on";
            const allycodeRaw = req.body.allycode as string | undefined;
            const sortBy = req.body.sortBy as string | undefined;

            let allycode: number | undefined;
            if (allycodeRaw !== undefined && allycodeRaw !== "") {
                allycode = Number.parseInt(allycodeRaw, 10);
                if (Number.isNaN(allycode) || !/^\d{9}$/.test(allycodeRaw)) {
                    req.session.flash = { type: "error", message: "Ally code must be exactly 9 digits." };
                    return res.redirect("/config/edit/guild-update");
                }
            }

            await updateUser(user.id, {
                guildUpdate: {
                    enabled,
                    allycode: allycode ?? userConfig.guildUpdate?.allycode ?? 0,
                    sortBy: sortBy ?? userConfig.guildUpdate?.sortBy ?? "",
                },
            });

            req.session.flash = { type: "success", message: "Guild update settings saved." };
            res.redirect("/config");
        } catch (err) {
            console.error("Config update error (guild-update):", err);
            req.session.flash = { type: "error", message: "Failed to save settings. Please try again." };
            res.redirect("/config");
        }
    });

    // GET /config/edit/guild-tickets — edit guild tickets settings (Patreon required)
    app.get("/config/edit/guild-tickets", async (req: Request, res: Response) => {
        if (!req.session.user) {
            req.session.returnTo = "/config/edit/guild-tickets";
            return res.redirect("/login");
        }
        const user = req.session.user;
        const userConfig = await getUser(user.id);
        const isPatreon = (userConfig?.patreonAmountCents ?? 0) > 0;
        if (!isPatreon) {
            req.session.flash = { type: "error", message: "This feature requires an active Patreon subscription." };
            return res.redirect("/config");
        }
        const csrfToken = generateCsrfToken(req);
        res.render("pages/config-edit-guild-tickets", {
            title: "Edit Guild Tickets Settings — SWGoHBot",
            description: "Edit your SWGoHBot guild tickets settings.",
            user,
            userConfig,
            csrfToken,
        });
    });

    // POST /config/guild-tickets — save guild tickets settings (Patreon required)
    app.post("/config/guild-tickets", async (req: Request, res: Response) => {
        if (!req.session.user) return res.redirect("/login");
        if (!verifyCsrfToken(req)) return res.status(403).send("Forbidden");

        const user = req.session.user;
        try {
            const userConfig = await getUser(user.id);
            if (!userConfig) {
                req.session.flash = { type: "error", message: "Config not found." };
                return res.redirect("/config");
            }
            if ((userConfig.patreonAmountCents ?? 0) <= 0) {
                return res.status(403).send("Forbidden");
            }

            const VALID_SORT_BY = ["tickets", "name"];

            const enabled = req.body.enabled === "on";
            const sortBy = req.body.sortBy as string | undefined;
            const showMax = req.body.showMax === "on";

            if (sortBy && !VALID_SORT_BY.includes(sortBy)) {
                req.session.flash = { type: "error", message: "Invalid sort by value selected." };
                return res.redirect("/config/edit/guild-tickets");
            }

            await updateUser(user.id, {
                guildTickets: {
                    enabled,
                    sortBy: sortBy ?? userConfig.guildTickets?.sortBy ?? "tickets",
                    showMax,
                },
            });

            req.session.flash = { type: "success", message: "Guild tickets settings saved." };
            res.redirect("/config");
        } catch (err) {
            console.error("Config update error (guild-tickets):", err);
            req.session.flash = { type: "error", message: "Failed to save settings. Please try again." };
            res.redirect("/config");
        }
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
