import crypto from "node:crypto";
import type { Request } from "express";

export function generateCsrfToken(req: Request): string {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    }
    return req.session.csrfToken;
}

export function verifyCsrfToken(req: Request): boolean {
    const token = req.body._csrf as string | undefined;
    return !!token && token === req.session.csrfToken;
}

export function rotateCsrfToken(req: Request): string {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    return req.session.csrfToken;
}
