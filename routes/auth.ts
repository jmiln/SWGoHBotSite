import type { Request, Response } from "express";
import { Router } from "express";
import { authLimiter } from "../middleware/rateLimit.ts";
import * as auth from "../modules/auth.ts";
import { generateCsrfToken, verifyCsrfToken } from "../modules/csrf.ts";
import { env } from "../modules/env.ts";
import logger from "../modules/logger.ts";
import { createOAuthState, verifyOAuthState } from "../modules/oauthStateToken.ts";

const router = Router();
const SESSION_COOKIE_NAME = "connect.sid";

// Prevent Cloudflare (and any other proxy) from caching auth responses.
// Cloudflare strips Set-Cookie headers from cached responses, which breaks the OAuth flow.
router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
});

function getSafeLoggedOutReturnTo(returnTo?: string): string {
    if (!returnTo?.startsWith("/") || returnTo.startsWith("//")) {
        return "/";
    }

    return returnTo;
}

router.get("/login", authLimiter, (req: Request, res: Response) => {
    // Determine where to send the user after login.
    // Priority: ?returnTo query param > session.returnTo (set by protected routes) > Referer > "/"
    let returnTo = "/";
    const rawReturnTo = req.query.returnTo as string;
    if (rawReturnTo?.startsWith("/") && !rawReturnTo.startsWith("//")) {
        returnTo = rawReturnTo;
    } else if (req.session.returnTo) {
        returnTo = req.session.returnTo;
    } else {
        const referer = req.get("Referer");
        if (referer) {
            try {
                const url = new URL(referer);
                if (url.origin === `${req.protocol}://${req.get("host")}`) {
                    returnTo = url.pathname;
                }
            } catch {
                // malformed Referer — ignore
            }
        }
    }

    // The state is a signed token containing returnTo and a timestamp.
    // No session write or cookie is needed — the signature is verified at callback time.
    const state = createOAuthState(returnTo);
    res.redirect(auth.buildDiscordAuthURL(state));
});

router.get("/callback", authLimiter, async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;

    if (!state) {
        return res.status(403).render("pages/500", {
            title: "Forbidden - SWGoHBot",
            description: "Invalid OAuth state. Please try logging in again.",
        });
    }

    // Already logged in and arrived at callback (e.g. browser back button) — just redirect.
    if (req.session.user) {
        return res.redirect("/");
    }

    if (!code) {
        return res.redirect("/");
    }

    const returnTo = verifyOAuthState(state);
    if (returnTo === null) {
        logger.warn(`OAuth callback: state verification failed (state=${state.slice(0, 20)}...)`);
        return res.status(403).render("pages/500", {
            title: "Forbidden - SWGoHBot",
            description: "Invalid OAuth state. Please try logging in again.",
        });
    }

    try {
        const { accessToken, refreshToken, expiresIn } = await auth.exchangeCodeForToken(code);
        if (!refreshToken || !expiresIn) {
            logger.error("OAuth callback: Discord token response missing refreshToken or expiresIn");
            return res.status(500).render("pages/500", {
                title: "Server Error - SWGoHBot",
                description: "Failed to complete login. Please try again.",
            });
        }
        const discordUser = await auth.fetchDiscordUser(accessToken);
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
        req.session.refreshToken = refreshToken;
        req.session.tokenExpiresAt = Date.now() + expiresIn * 1000;
        generateCsrfToken(req);
        await new Promise<void>((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        res.redirect(returnTo);
    } catch (err) {
        logger.error(`OAuth callback error: ${err}`);
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
