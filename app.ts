import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ErrorRequestHandler, Express, NextFunction, Request, Response } from "express";
import express from "express";
import { requireAdmin } from "./middleware/admin.ts";
import { globalLimiter } from "./middleware/rateLimit.ts";
import { applySecurity } from "./middleware/security.ts";
import { applySession } from "./middleware/session.ts";
import * as commandService from "./modules/commandService.ts";
import { generateCsrfToken, verifyCsrfToken } from "./modules/csrf.ts";
import { connectDB } from "./modules/db.ts";
import { env } from "./modules/env.ts";
import logger from "./modules/logger.ts";
import { ARENA_OFFSETS, formatPayoutTimes, getTimeLeft } from "./modules/payout.ts";
import { loadPlugins } from "./modules/pluginLoader.ts";
import authRoutes from "./routes/auth.ts";
import guildConfigRoutes from "./routes/guildConfig.ts";
import guildEventRoutes from "./routes/guildEvents.ts";
import guildSelectRoutes from "./routes/guildSelect.ts";
import publicRoutes from "./routes/public.ts";
import userConfigRoutes from "./routes/userConfig.ts";
import type { PluginContext } from "./types/plugin.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function createApp(): Promise<Express> {
    const app = express();

    app.set("trust proxy", "loopback, linklocal, uniquelocal");

    applySecurity(app);
    applySession(app);

    app.use((req: Request, res: Response, next: NextFunction) => {
        res.locals.user = req.session.user ?? null;
        res.locals.isAdmin = req.session.user?.id === env.ADMIN_DISCORD_ID;
        res.locals.currentPath = req.path;
        res.locals.logoutCsrfToken = req.session.user ? (req.session.csrfToken ?? null) : null;
        next();
    });

    app.use(globalLimiter);

    app.locals.formatPayoutTimes = formatPayoutTimes;
    app.locals.getTimeLeft = getTimeLeft;
    app.locals.ARENA_OFFSETS = ARENA_OFFSETS;
    app.locals.partialsPath = join(__dirname, "partials");
    app.locals.escapeAttr = (str: string): string => {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    };

    logger.log("Loading bot command data...");
    commandService.initialize();

    await connectDB();
    logger.log("Connected to bot database.");

    const pluginCtx: PluginContext = {
        env: process.env,
        logger,
        requireAdmin,
        generateCsrfToken,
        verifyCsrfToken,
        partialsPath: join(__dirname, "partials"),
    };

    const plugins = await loadPlugins(pluginCtx);

    const viewPaths: string[] = [__dirname, ...plugins.flatMap((p) => p.viewPaths ?? [])];
    app.set("views", viewPaths);
    app.set("view engine", "ejs");

    for (const plugin of plugins) {
        if (plugin.staticDir && plugin.staticMountPath) {
            app.use(plugin.staticMountPath, express.static(plugin.staticDir));
        }
    }

    app.use("/", publicRoutes);
    app.use("/", authRoutes);
    app.use("/", userConfigRoutes);
    app.use("/", guildSelectRoutes);
    app.use("/", guildConfigRoutes);
    app.use("/", guildEventRoutes);

    app.locals.pluginNavItems = plugins.flatMap((p) => p.navItems ?? []);

    for (const plugin of plugins) {
        app.use(plugin.mountPath, plugin.router);
        logger.log(`Mounted plugin: ${plugin.name} at ${plugin.mountPath}`);
    }

    app.use((_req: Request, res: Response) => {
        res.status(404).render("pages/404", {
            title: "Page Not Found - SWGoHBot",
            description: "The page you're looking for doesn't exist.",
        });
    });

    const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
        if (env.NODE_ENV !== "production") {
            logger.error(err.stack);
        } else {
            logger.error(`Error: ${err.message}`);
        }
        res.status(500).render("pages/500", {
            title: "Server Error - SWGoHBot",
            description: "Something went wrong on our end.",
        });
    };
    app.use(errorHandler);

    return app;
}
