import type { NextFunction, Request, Response } from "express";

export function requireLogin(req: Request, res: Response, next: NextFunction): void {
    if (req.session.user) {
        next();
        return;
    }
    res.redirect(`/login?returnTo=${encodeURIComponent(req.path)}`);
}
