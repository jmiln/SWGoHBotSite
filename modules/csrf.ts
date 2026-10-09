import crypto from "node:crypto";
import type { Request } from "express";

export function generateCsrfToken(req: Request): string {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    }
    return req.session.csrfToken;
}

export function verifyCsrfToken(req: Request): boolean {
    const submitted = req.body._csrf;
    const expected = req.session.csrfToken;
    if (typeof submitted !== "string" || !expected) return false;
    const submittedBytes = Buffer.from(submitted);
    const expectedBytes = Buffer.from(expected);
    return submittedBytes.length === expectedBytes.length && crypto.timingSafeEqual(submittedBytes, expectedBytes);
}

export function rotateCsrfToken(req: Request): string {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    return req.session.csrfToken;
}
