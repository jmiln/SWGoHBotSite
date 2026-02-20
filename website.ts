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
import * as commandService from "./modules/commandService.ts";
import { env } from "./modules/env.ts";

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

    // Expose session user to all EJS templates as `user`
    app.use((_req: Request, res: Response, next: NextFunction) => {
        res.locals.user = _req.session.user ?? null;
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

    // Add EJS helper for HTML attribute escaping
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
            return res.status(403).render("pages/404", {
                title: "Forbidden - SWGoHBot",
                description: "Invalid OAuth state. Please try logging in again.",
            });
        }
        delete req.session.oauthState;

        if (!code) {
            return res.redirect("/");
        }

        try {
            const accessToken = await auth.exchangeCodeForToken(code);
            const discordUser = await auth.fetchDiscordUser(accessToken);
            req.session.user = {
                id: discordUser.id,
                username: discordUser.username,
                avatar: discordUser.avatar,
            };
            const returnTo = req.session.returnTo ?? "/dashboard";
            delete req.session.returnTo;
            res.redirect(returnTo);
        } catch (err) {
            console.error("OAuth callback error:", err);
            res.redirect("/");
        }
    });

    // Logout — destroy session and redirect home
    app.get("/logout", (req: Request, res: Response) => {
        req.session.destroy(() => {
            res.redirect("/");
        });
    });

    // Dashboard — requires login
    app.get("/dashboard", (req: Request, res: Response) => {
        if (!req.session.user) {
            req.session.returnTo = "/dashboard";
            return res.redirect("/login");
        }

        const user = req.session.user;
        const avatarURL = user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
            : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.id) % 5n)}.png`;

        res.render("pages/dashboard", {
            title: "Dashboard - SWGoHBot",
            description: "Your SWGoHBot dashboard.",
            user,
            avatarURL,
        });
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
