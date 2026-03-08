import crypto from "node:crypto";
import type { Request, Response } from "express";
import { Router } from "express";
import { authLimiter } from "../middleware/rateLimit.ts";
import * as auth from "../modules/auth.ts";

const router = Router();

router.get("/login", authLimiter, (req: Request, res: Response) => {
    const state = crypto.randomBytes(16).toString("hex");
    req.session.oauthState = state;
    const rawReturnTo = req.query.returnTo as string;
    req.session.returnTo = rawReturnTo?.startsWith("/") && !rawReturnTo.startsWith("//") ? rawReturnTo : "/config";
    res.redirect(auth.buildDiscordAuthURL(state));
});

router.get("/callback", authLimiter, async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;

    if (!state || state !== req.session.oauthState) {
        return res.status(403).render("pages/500", {
            title: "Forbidden - SWGoHBot",
            description: "Invalid OAuth state. Please try logging in again.",
        });
    }
    delete req.session.oauthState;

    if (!code) {
        return res.redirect("/");
    }

    try {
        const { accessToken } = await auth.exchangeCodeForToken(code);
        const discordUser = await auth.fetchDiscordUser(accessToken);
        const returnTo = req.session.returnTo ?? "/dashboard";
        await new Promise<void>((resolve, reject) => {
            req.session.regenerate((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        req.session.user = {
            id: discordUser.id,
            username: discordUser.username,
            avatar: discordUser.avatar,
        };
        req.session.accessToken = accessToken;
        await new Promise<void>((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        res.redirect(returnTo);
    } catch (err) {
        console.error("OAuth callback error:", err);
        res.redirect("/");
    }
});

router.post("/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

export default router;
