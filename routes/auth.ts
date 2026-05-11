import crypto from "node:crypto";
import type { Request, Response } from "express";
import { Router } from "express";
import { authLimiter } from "../middleware/rateLimit.ts";
import * as auth from "../modules/auth.ts";
import { generateCsrfToken, verifyCsrfToken } from "../modules/csrf.ts";
import { env } from "../modules/env.ts";
import logger from "../modules/logger.ts";
import {
    clearOAuthReturnToCookie,
    clearOAuthStateCookie,
    getOAuthReturnToCookie,
    getOAuthStateCookie,
    setOAuthReturnToCookie,
    setOAuthStateCookie,
} from "../modules/oauthState.ts";

const router = Router();
const SESSION_COOKIE_NAME = "connect.sid";

function getSafeLoggedOutReturnTo(returnTo?: string): string {
    if (!returnTo?.startsWith("/") || returnTo.startsWith("//")) {
        return "/";
    }

    return returnTo;
}

router.get("/login", authLimiter, (req: Request, res: Response) => {
    const state = crypto.randomBytes(16).toString("hex");
    req.session.oauthState = state;
    setOAuthStateCookie(res, state);
    const rawReturnTo = req.query.returnTo as string;
    if (rawReturnTo?.startsWith("/") && !rawReturnTo.startsWith("//")) {
        req.session.returnTo = rawReturnTo;
    } else if (!req.session.returnTo) {
        const referer = req.get("Referer");
        let refererPath: string | undefined;
        if (referer) {
            try {
                const url = new URL(referer);
                if (url.origin === `${req.protocol}://${req.get("host")}`) {
                    refererPath = url.pathname;
                }
            } catch {
                // malformed Referer — ignore
            }
        }
        req.session.returnTo = refererPath ?? "/";
    }
    setOAuthReturnToCookie(res, req.session.returnTo ?? "/");
    req.session.save((err) => {
        if (err) logger.error(`Session save error in /login: ${err}`);
        res.redirect(auth.buildDiscordAuthURL(state));
    });
});

router.get("/callback", authLimiter, async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const cookieState = getOAuthStateCookie(req);
    const cookieReturnTo = getOAuthReturnToCookie(req);
    const sessionState = req.session.oauthState;
    const fallbackReturnTo = req.session.returnTo ?? cookieReturnTo ?? "/";

    if (!state || (state !== sessionState && state !== cookieState)) {
        if (!sessionState) {
            logger.warn("OAuth callback: session not found (no oauthState in session), attempted cookie fallback — state mismatch");
        }
        if (req.session.user) {
            clearOAuthStateCookie(res);
            clearOAuthReturnToCookie(res);
            return res.redirect(fallbackReturnTo);
        }

        clearOAuthStateCookie(res);
        clearOAuthReturnToCookie(res);
        return res.status(403).render("pages/500", {
            title: "Forbidden - SWGoHBot",
            description: "Invalid OAuth state. Please try logging in again.",
        });
    }

    if (!sessionState) {
        logger.warn("OAuth callback: session not found in MongoDB — using cookie state fallback");
    }

    delete req.session.oauthState;
    clearOAuthStateCookie(res);
    clearOAuthReturnToCookie(res);

    if (!code) {
        return res.redirect("/");
    }

    try {
        const { accessToken } = await auth.exchangeCodeForToken(code);
        const discordUser = await auth.fetchDiscordUser(accessToken);
        const returnTo = fallbackReturnTo;
        await new Promise<void>((resolve) => {
            req.session.regenerate((err) => {
                // store.generate() always runs even if destroy fails, so the new session
                // is always created. A destroy failure only means the old session remains
                // in MongoDB until TTL expiry — not a security or functional concern.
                if (err) logger.warn(`Session destroy error during regenerate (non-fatal): ${err}`);
                resolve();
            });
        });
        req.session.user = {
            id: discordUser.id,
            username: discordUser.username,
            avatar: discordUser.avatar,
        };
        req.session.accessToken = accessToken;
        generateCsrfToken(req);
        await new Promise<void>((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        res.redirect(returnTo);
    } catch (err) {
        logger.error(`OAuth callback error (user: ${req.session.user?.id ?? "none"}, step: post-regenerate save): ${err}`);
        res.redirect("/");
    }
});

router.post("/logout", (req: Request, res: Response) => {
    if (!verifyCsrfToken(req)) {
        return res.status(403).render("pages/500", {
            title: "Forbidden - SWGoHBot",
            description: "Invalid request. Please refresh and try again.",
        });
    }

    const returnTo = getSafeLoggedOutReturnTo(req.body.returnTo as string | undefined);
    const sessionId = req.session.id;

    req.session.destroy((err) => {
        if (err) {
            logger.error(`Session destroy error in /logout: ${err}`);
            // Fire a background retry so the MongoDB document is still removed.
            // The cookie is cleared below regardless, ending the browser session now.
            req.sessionStore.destroy(sessionId, (retryErr) => {
                if (retryErr) logger.error(`Session store destroy retry failed in /logout: ${retryErr}`);
            });
        }

        res.clearCookie(SESSION_COOKIE_NAME, {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "lax",
        });
        res.redirect(returnTo);
    });
});

export default router;
