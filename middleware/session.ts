import MongoStore from "connect-mongo";
import type { Express, NextFunction, Request, Response } from "express";
import session from "express-session";
import { env } from "../modules/env.ts";

export function applySession(app: Express): void {
    app.use(
        session({
            store: MongoStore.create({
                mongoUrl: env.MONGODB_URI,
                // Match the cookie TTL so MongoDB doesn't expire sessions before the cookie does.
                ttl: 7 * 24 * 60 * 60,
            }),
            secret: env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false,
            rolling: true,
            cookie: {
                httpOnly: true,
                secure: env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 7 * 24 * 60 * 60 * 1000,
            },
        }),
    );

    app.use((req: Request, res: Response, next: NextFunction) => {
        res.locals.flash = req.session.flash ?? null;
        delete req.session.flash;
        next();
    });
}
