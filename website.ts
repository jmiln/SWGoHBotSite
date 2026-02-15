// Native Node Imports & Express Session
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

// Local modules
import * as commandService from "./modules/commandService.ts";

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
        if (process.env.NODE_ENV === "production") {
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

    // Security headers with helmet
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "https://code.jquery.com", "https://cdnjs.cloudflare.com"],
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

    // Serve static files first (no rate limiting needed for CDN-cached assets)
    const publicDir = path.join(__dirname, "/public");
    app.use(express.static(publicDir));

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

    app.get("/test-commands", (_req: Request, res: Response) => {
        res.render("pages/test-commands");
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
        if (process.env.NODE_ENV !== "production") {
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
    const port = Number.parseInt(process.env.PORT || "3300", 10);
    app.listen(port, () => {
        console.log(`Site listening on port ${port}!`);
    });
};

initSite();
