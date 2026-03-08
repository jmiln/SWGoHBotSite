import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ErrorRequestHandler, Express, Request, Response } from "express";
import express from "express";
import { globalLimiter } from "./middleware/rateLimit.ts";
import { applySecurity } from "./middleware/security.ts";
import { applySession } from "./middleware/session.ts";
import * as commandService from "./modules/commandService.ts";
import { connectDB } from "./modules/db.ts";
import { env } from "./modules/env.ts";
import { ARENA_OFFSETS, formatPayoutTimes, getTimeLeft } from "./modules/payout.ts";
import authRoutes from "./routes/auth.ts";
import guildConfigRoutes from "./routes/guildConfig.ts";
import guildEventRoutes from "./routes/guildEvents.ts";
import guildSelectRoutes from "./routes/guildSelect.ts";
import publicRoutes from "./routes/public.ts";
import userConfigRoutes from "./routes/userConfig.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function createApp(): Promise<Express> {
    const app = express();

    app.set("trust proxy", "loopback, linklocal, uniquelocal");

    applySecurity(app);
    applySession(app);

    app.use(globalLimiter);

    app.locals.formatPayoutTimes = formatPayoutTimes;
    app.locals.getTimeLeft = getTimeLeft;
    app.locals.ARENA_OFFSETS = ARENA_OFFSETS;
    app.locals.escapeAttr = (str: string): string => {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    };

    console.log("Loading bot command data...");
    commandService.initialize();

    await connectDB();
    console.log("Connected to bot database.");

    app.set("views", __dirname);
    app.set("view engine", "ejs");

    app.use("/", publicRoutes);
    app.use("/", authRoutes);
    app.use("/", userConfigRoutes);
    app.use("/", guildSelectRoutes);
    app.use("/", guildConfigRoutes);
    app.use("/", guildEventRoutes);

    app.use((_req: Request, res: Response) => {
        res.status(404).render("pages/404", {
            title: "Page Not Found - SWGoHBot",
            description: "The page you're looking for doesn't exist.",
        });
    });

    const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
        if (env.NODE_ENV !== "production") {
            console.error(err.stack);
        } else {
            console.error(`Error: ${err.message}`);
        }
        res.status(500).render("pages/500", {
            title: "Server Error - SWGoHBot",
            description: "Something went wrong on our end.",
        });
    };
    app.use(errorHandler);

    return app;
}
