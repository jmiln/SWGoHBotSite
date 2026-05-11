import crypto from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { env } from "../modules/env.ts";

export function applySecurity(app: Express): void {
    app.use((req: Request, res: Response, next: NextFunction) => {
        if (env.NODE_ENV === "production") {
            const proto = Array.isArray(req.headers["x-forwarded-proto"])
                ? req.headers["x-forwarded-proto"][0]
                : req.headers["x-forwarded-proto"];
            if (proto !== "https") {
                const url = req.url.replace(/^\/+/, "/");
                res.redirect(301, `https://${req.hostname}${url}`);
                return;
            }
        }
        next();
    });

    app.use((_req: Request, res: Response, next: NextFunction) => {
        res.locals.nonce = crypto.randomBytes(16).toString("base64");
        next();
    });

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
                    styleSrc: ["'self'", "https://cdnjs.cloudflare.com"],
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

    app.use((_req: Request, res: Response, next: NextFunction) => {
        res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=()");
        next();
    });
}
