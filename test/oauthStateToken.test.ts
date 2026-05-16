import crypto from "node:crypto";
import assert from "node:assert";
import { test } from "node:test";

process.env.BOT_DATA_PATH = "/tmp";
process.env.BOT_SCHEMAS_PATH = "/tmp";
process.env.DISCORD_CLIENT_ID = "test";
process.env.DISCORD_CLIENT_SECRET = "test";
process.env.DISCORD_REDIRECT_URI = "http://localhost:3300/callback";
process.env.MONGODB_URI = "mongodb://localhost:27017/test";
process.env.MONGODB_BOT_DB = "test";
process.env.SESSION_SECRET = "test-session-secret-16chars";
process.env.DISCORD_BOT_TOKEN = "test";
process.env.MONGODB_SWAPI_DB = "test";
process.env.ADMIN_DISCORD_ID = "111111111111111111";

const { createOAuthState, verifyOAuthState } = await import("../modules/oauthStateToken.ts");

// ---- helpers ----

function toBase64url(buf: Buffer): string {
    return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/** Build a token with a specific timestamp using the test secret, to test expiry/future checks. */
function buildTokenWithTimestamp(returnTo: string, ts: number): string {
    const payload = JSON.stringify({ v: 1, r: returnTo, ts });
    const payloadB64 = toBase64url(Buffer.from(payload));
    const sig = toBase64url(
        crypto.createHmac("sha256", process.env.SESSION_SECRET as string).update(payloadB64).digest(),
    );
    return `${payloadB64}.${sig}`;
}

// ---- tests ----

test("createOAuthState returns a dot-separated token string", () => {
    const state = createOAuthState("/config");
    assert.match(state, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
});

test("verifyOAuthState round-trips a valid token", () => {
    const state = createOAuthState("/config");
    assert.strictEqual(verifyOAuthState(state), "/config");
});

test("verifyOAuthState round-trips the root path", () => {
    const state = createOAuthState("/");
    assert.strictEqual(verifyOAuthState(state), "/");
});

test("verifyOAuthState normalises an unsafe returnTo to /", () => {
    const state = createOAuthState("//evil.com");
    // createOAuthState sanitises before signing, so verify returns "/"
    assert.strictEqual(verifyOAuthState(state), "/");
});

test("verifyOAuthState returns null for a tampered signature", () => {
    const state = createOAuthState("/config");
    const [payload] = state.split(".");
    const badState = `${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    assert.strictEqual(verifyOAuthState(badState), null);
});

test("verifyOAuthState returns null for a tampered payload", () => {
    const state = createOAuthState("/config");
    const [, sig] = state.split(".");
    const tampered = toBase64url(Buffer.from(JSON.stringify({ v: 1, r: "/admin", ts: Math.floor(Date.now() / 1000) })));
    assert.strictEqual(verifyOAuthState(`${tampered}.${sig}`), null);
});

test("verifyOAuthState returns null when separator is missing", () => {
    assert.strictEqual(verifyOAuthState("nodotinhere"), null);
});

test("verifyOAuthState returns null for empty string", () => {
    assert.strictEqual(verifyOAuthState(""), null);
});

test("verifyOAuthState returns null for an expired token", () => {
    const expired = buildTokenWithTimestamp("/config", 0); // ts=0 is way in the past
    assert.strictEqual(verifyOAuthState(expired), null);
});

test("verifyOAuthState returns null for a future-dated token", () => {
    const futureTs = Math.floor(Date.now() / 1000) + 3600; // 1 hour in the future
    const future = buildTokenWithTimestamp("/config", futureTs);
    assert.strictEqual(verifyOAuthState(future), null);
});

test("verifyOAuthState returns null for garbage input", () => {
    assert.strictEqual(verifyOAuthState("not.a.valid.token.at.all"), null);
});

test("verifyOAuthState returns null for a token with a valid signature but non-JSON payload", () => {
    const payloadB64 = toBase64url(Buffer.from("not-valid-json!!!"));
    const sig = toBase64url(
        crypto.createHmac("sha256", process.env.SESSION_SECRET as string).update(payloadB64).digest(),
    );
    assert.strictEqual(verifyOAuthState(`${payloadB64}.${sig}`), null);
});
