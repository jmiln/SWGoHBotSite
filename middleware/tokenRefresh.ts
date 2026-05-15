import type { NextFunction, Request, Response } from "express";
import * as auth from "../modules/auth.ts";
import logger from "../modules/logger.ts";

type RefreshFn = (token: string) => Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>;

async function destroyAndRedirect(req: Request, res: Response): Promise<void> {
    const returnTo = req.path;
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    res.redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
}

export function createTokenRefreshMiddleware(refreshFn: RefreshFn) {
    return async function requireFreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
        if (!req.session.user) {
            next();
            return;
        }

        const { refreshToken, tokenExpiresAt } = req.session;

        if (!refreshToken || !tokenExpiresAt) {
            await destroyAndRedirect(req, res);
            return;
        }

        const REFRESH_WINDOW_MS = 5 * 60 * 1000;
        if (Date.now() < tokenExpiresAt - REFRESH_WINDOW_MS) {
            next();
            return;
        }

        try {
            const result = await refreshFn(refreshToken);
            req.session.accessToken = result.accessToken;
            req.session.refreshToken = result.refreshToken;
            req.session.tokenExpiresAt = Date.now() + result.expiresIn * 1000;
            await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
            logger.debug("Discord access token refreshed successfully");
            next();
        } catch (err) {
            logger.warn(`Token refresh failed, forcing re-login: ${err instanceof Error ? err.message : String(err)}`);
            await destroyAndRedirect(req, res);
        }
    };
}

export const requireFreshToken = createTokenRefreshMiddleware(auth.refreshAccessToken);
