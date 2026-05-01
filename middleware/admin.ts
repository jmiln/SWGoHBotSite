import type { NextFunction, Request, Response } from "express";
import { env } from "../modules/env.ts";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    if (req.session.user?.id === env.ADMIN_DISCORD_ID) {
        next();
        return;
    }
    res.status(403).render("pages/500", {
        title: "Forbidden - SWGoHBot",
        description: "You do not have permission to view this page.",
    });
}
