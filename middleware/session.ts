import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import MongoStore from "connect-mongo";
import type { Express, NextFunction, Request, Response } from "express";
import express from "express";
import session from "express-session";
import { env } from "../modules/env.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function applySession(app: Express): void {
    app.use(express.static(path.join(__dirname, "../public")));

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
                maxAge: 7 * 24 * 60 * 60 * 1000,
            },
        }),
    );

    app.use(express.urlencoded({ extended: false }));

    app.use((req: Request, res: Response, next: NextFunction) => {
        res.locals.flash = req.session.flash ?? null;
        delete req.session.flash;
        next();
    });

    app.use((req: Request, res: Response, next: NextFunction) => {
        res.locals.user = req.session.user ?? null;
        res.locals.currentPath = req.path;
        next();
    });
}
