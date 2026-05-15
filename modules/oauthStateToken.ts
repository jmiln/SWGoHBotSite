import crypto from "node:crypto";
import { env } from "./env.ts";

interface StatePayload {
    v: 1;
    r: string; // returnTo path
    ts: number; // unix seconds
}

const STATE_TTL_SECONDS = 10 * 60;

function toBase64url(buf: Buffer): string {
    return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64url(str: string): Buffer {
    const padded = str.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (padded.length % 4)) % 4;
    return Buffer.from(padded + "=".repeat(padding), "base64");
}

function sign(data: string): string {
    return toBase64url(crypto.createHmac("sha256", env.SESSION_SECRET).update(data).digest());
}

/** Build a signed OAuth state token embedding returnTo. */
export function createOAuthState(returnTo: string): string {
    const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
    const payload: StatePayload = { v: 1, r: safeReturnTo, ts: Math.floor(Date.now() / 1000) };
    const payloadB64 = toBase64url(Buffer.from(JSON.stringify(payload)));
    return `${payloadB64}.${sign(payloadB64)}`;
}

/** Verify a state token. Returns returnTo on success, null on failure. */
export function verifyOAuthState(state: string): string | null {
    const dot = state.indexOf(".");
    if (dot === -1) return null;

    const payloadB64 = state.slice(0, dot);
    const sigB64 = state.slice(dot + 1);
    const expectedSig = sign(payloadB64);

    // Constant-time comparison (both must be same length — base64url of sha256 is always 43 chars)
    if (sigB64.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sigB64), Buffer.from(expectedSig))) {
        return null;
    }

    let payload: StatePayload;
    try {
        payload = JSON.parse(fromBase64url(payloadB64).toString("utf8")) as StatePayload;
    } catch {
        return null;
    }

    if (payload.v !== 1) return null;

    const age = Math.floor(Date.now() / 1000) - payload.ts;
    if (age < 0 || age > STATE_TTL_SECONDS) return null;

    return payload.r?.startsWith("/") && !payload.r?.startsWith("//") ? payload.r : "/";
}
