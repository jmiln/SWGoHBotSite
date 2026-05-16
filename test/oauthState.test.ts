import assert from "node:assert";
import { test } from "node:test";
import type { Request, Response } from "express";

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

const {
    clearOAuthReturnToCookie,
    clearOAuthStateCookie,
    getOAuthReturnToCookie,
    getOAuthStateCookie,
    setOAuthReturnToCookie,
    setOAuthStateCookie,
} = await import("../modules/oauthState.ts");

function makeReq(cookie?: string): Request {
    return { headers: { cookie } } as unknown as Request;
}

function makeRes() {
    const cookies: string[] = [];
    return {
        cookies,
        append(name: string, value: string) {
            if (name === "Set-Cookie") {
                cookies.push(value);
            }
            return this;
        },
    } as Response & { cookies: string[] };
}

test("getOAuthStateCookie reads the OAuth state cookie from the request header", () => {
    const req = makeReq("foo=bar; swgohbot_oauth_state=test-state; fizz=buzz");
    assert.strictEqual(getOAuthStateCookie(req), "test-state");
});

test("setOAuthStateCookie appends a short-lived httpOnly cookie", () => {
    const res = makeRes();
    setOAuthStateCookie(res, "test-state");

    assert.strictEqual(res.cookies.length, 1);
    assert.match(res.cookies[0], /^swgohbot_oauth_state=test-state; Path=\/; HttpOnly; SameSite=Lax; Max-Age=600$/);
});

test("clearOAuthStateCookie appends an expired OAuth state cookie", () => {
    const res = makeRes();
    clearOAuthStateCookie(res);

    assert.strictEqual(res.cookies.length, 1);
    assert.match(res.cookies[0], /^swgohbot_oauth_state=; Path=\/; HttpOnly; SameSite=Lax; Max-Age=0$/);
});

test("getOAuthReturnToCookie reads the returnTo cookie from the request header", () => {
    const req = makeReq("foo=bar; swgohbot_return_to=%2Fconfig; fizz=buzz");
    assert.strictEqual(getOAuthReturnToCookie(req), "/config");
});

test("setOAuthReturnToCookie appends a short-lived httpOnly cookie", () => {
    const res = makeRes();
    setOAuthReturnToCookie(res, "/config");

    assert.strictEqual(res.cookies.length, 1);
    assert.match(res.cookies[0], /^swgohbot_return_to=%2Fconfig; Path=\/; HttpOnly; SameSite=Lax; Max-Age=600$/);
});

test("getOAuthStateCookie returns undefined when no cookie header is present", () => {
    const req = makeReq();
    assert.strictEqual(getOAuthStateCookie(req), undefined);
});

test("parseCookieHeader handles a cookie part that has no = sign", () => {
    const req = makeReq("justflag; swgohbot_oauth_state=found");
    assert.strictEqual(getOAuthStateCookie(req), "found");
});

test("clearOAuthReturnToCookie appends an expired returnTo cookie", () => {
    const res = makeRes();
    clearOAuthReturnToCookie(res);

    assert.strictEqual(res.cookies.length, 1);
    assert.match(res.cookies[0], /^swgohbot_return_to=; Path=\/; HttpOnly; SameSite=Lax; Max-Age=0$/);
});
