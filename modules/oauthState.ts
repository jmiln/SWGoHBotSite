import type { Request, Response } from "express";
import { env } from "./env.ts";

const OAUTH_STATE_COOKIE_NAME = "swgohbot_oauth_state";
const OAUTH_RETURN_TO_COOKIE_NAME = "swgohbot_return_to";
const OAUTH_STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60;

function buildCookie(name: string, value: string, maxAgeSeconds: number): string {
    const parts = [
        `${name}=${encodeURIComponent(value)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${maxAgeSeconds}`,
    ];

    if (env.NODE_ENV === "production") {
        parts.push("Secure");
    }

    return parts.join("; ");
}

function parseCookieHeader(header: string | undefined): Map<string, string> {
    if (!header) {
        return new Map();
    }

    return new Map(
        header
            .split(";")
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => {
                const equalsIndex = part.indexOf("=");
                if (equalsIndex === -1) {
                    return [part, ""] as const;
                }

                const key = part.slice(0, equalsIndex);
                const value = part.slice(equalsIndex + 1);
                return [key, decodeURIComponent(value)] as const;
            }),
    );
}

export function setOAuthStateCookie(res: Response, state: string): void {
    res.append("Set-Cookie", buildCookie(OAUTH_STATE_COOKIE_NAME, state, OAUTH_STATE_COOKIE_MAX_AGE_SECONDS));
}

export function clearOAuthStateCookie(res: Response): void {
    res.append("Set-Cookie", buildCookie(OAUTH_STATE_COOKIE_NAME, "", 0));
}

export function getOAuthStateCookie(req: Request): string | undefined {
    return parseCookieHeader(req.headers.cookie).get(OAUTH_STATE_COOKIE_NAME);
}

export function setOAuthReturnToCookie(res: Response, returnTo: string): void {
    res.append("Set-Cookie", buildCookie(OAUTH_RETURN_TO_COOKIE_NAME, returnTo, OAUTH_STATE_COOKIE_MAX_AGE_SECONDS));
}

export function clearOAuthReturnToCookie(res: Response): void {
    res.append("Set-Cookie", buildCookie(OAUTH_RETURN_TO_COOKIE_NAME, "", 0));
}

export function getOAuthReturnToCookie(req: Request): string | undefined {
    return parseCookieHeader(req.headers.cookie).get(OAUTH_RETURN_TO_COOKIE_NAME);
}
