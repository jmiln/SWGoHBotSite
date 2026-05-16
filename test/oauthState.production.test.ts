import assert from "node:assert";
import { test } from "node:test";
import type { Response } from "express";

// Must be set before any import that touches env.ts
process.env.NODE_ENV = "production";
process.env.BOT_DATA_PATH = "/tmp";
process.env.BOT_SCHEMAS_PATH = "/tmp";
process.env.DISCORD_CLIENT_ID = "test";
process.env.DISCORD_CLIENT_SECRET = "test";
process.env.DISCORD_REDIRECT_URI = "http://localhost:3300/callback";
process.env.MONGODB_URI = "mongodb://localhost:27018/test";
process.env.MONGODB_BOT_DB = "test";
process.env.SESSION_SECRET = "test-session-secret-16ch";
process.env.DISCORD_BOT_TOKEN = "test";
process.env.MONGODB_SWAPI_DB = "test";
process.env.ADMIN_DISCORD_ID = "111111111111111111";

const { setOAuthStateCookie, clearOAuthStateCookie, setOAuthReturnToCookie } = await import("../modules/oauthState.ts");

function makeRes() {
    const cookies: string[] = [];
    return {
        cookies,
        append(name: string, value: string) {
            if (name === "Set-Cookie") cookies.push(value);
            return this;
        },
    } as Response & { cookies: string[] };
}

test("setOAuthStateCookie appends Secure flag at end of cookie in production", () => {
    const res = makeRes();
    setOAuthStateCookie(res, "test-state");
    assert.strictEqual(res.cookies.length, 1);
    assert.match(
        res.cookies[0],
        /^swgohbot_oauth_state=test-state; Path=\/; HttpOnly; SameSite=Lax; Max-Age=600; Secure$/,
    );
});

test("clearOAuthStateCookie appends Secure flag at end of expired cookie in production", () => {
    const res = makeRes();
    clearOAuthStateCookie(res);
    assert.strictEqual(res.cookies.length, 1);
    assert.match(
        res.cookies[0],
        /^swgohbot_oauth_state=; Path=\/; HttpOnly; SameSite=Lax; Max-Age=0; Secure$/,
    );
});

test("setOAuthReturnToCookie appends Secure flag at end of cookie in production", () => {
    const res = makeRes();
    setOAuthReturnToCookie(res, "/config");
    assert.strictEqual(res.cookies.length, 1);
    assert.match(
        res.cookies[0],
        /^swgohbot_return_to=%2Fconfig; Path=\/; HttpOnly; SameSite=Lax; Max-Age=600; Secure$/,
    );
});
