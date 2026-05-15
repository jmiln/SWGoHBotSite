import assert from "node:assert";
import { describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";

process.env.DISCORD_CLIENT_ID = "test-client-id";
process.env.DISCORD_CLIENT_SECRET = "test-client-secret";
process.env.DISCORD_REDIRECT_URI = "http://localhost:3300/callback";
process.env.MONGODB_URI = "mongodb://localhost:27018/test?directConnection=true";
process.env.MONGODB_BOT_DB = "testBotDB";
process.env.MONGODB_SWAPI_DB = "testSwapiDB";
process.env.SESSION_SECRET = "test-session-secret-16ch";
process.env.DISCORD_BOT_TOKEN = "test-bot-token";
process.env.ADMIN_DISCORD_ID = "test-admin-id";
process.env.BOT_DATA_PATH = "/tmp";
process.env.BOT_SCHEMAS_PATH = "/tmp";

const { createTokenRefreshMiddleware } = await import("../middleware/tokenRefresh.ts");

const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

type FakeSession = {
    user?: { id: string; username: string; avatar: string | null };
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: number;
    destroy: (cb: () => void) => void;
    save: (cb: (err?: Error) => void) => void;
};

function makeReq(overrides: Partial<FakeSession> & { path?: string } = {}): Request {
    const { path = "/guild-select", ...sessionFields } = overrides;
    const session: FakeSession = {
        user: { id: "123", username: "testuser", avatar: null },
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenExpiresAt: Date.now() + HOUR_MS,
        destroy: (cb) => cb(),
        save: (cb) => cb(),
        ...sessionFields,
    };
    return { path, session } as unknown as Request;
}

function makeRes(): Response & { redirectUrl: string } {
    const res = {
        redirectUrl: "",
        redirect(url: string) {
            this.redirectUrl = url;
        },
    };
    return res as unknown as Response & { redirectUrl: string };
}

const neverCalled = async (): Promise<never> => {
    throw new Error("refreshFn should not have been called");
};

describe("requireFreshToken", () => {
    it("calls next() immediately when no user is in session", async () => {
        const mw = createTokenRefreshMiddleware(neverCalled);
        const req = makeReq({ user: undefined });
        const res = makeRes();
        let nextCalled = false;
        await mw(req, res, (() => {
            nextCalled = true;
        }) as NextFunction);
        assert.ok(nextCalled);
        assert.strictEqual(res.redirectUrl, "");
    });

    it("destroys session and redirects when refreshToken is missing", async () => {
        const mw = createTokenRefreshMiddleware(neverCalled);
        const req = makeReq({ refreshToken: undefined });
        const res = makeRes();
        let nextCalled = false;
        await mw(req, res, (() => {
            nextCalled = true;
        }) as NextFunction);
        assert.ok(!nextCalled);
        assert.ok(res.redirectUrl.startsWith("/login?returnTo="));
    });

    it("destroys session and redirects when tokenExpiresAt is missing", async () => {
        const mw = createTokenRefreshMiddleware(neverCalled);
        const req = makeReq({ tokenExpiresAt: undefined });
        const res = makeRes();
        let nextCalled = false;
        await mw(req, res, (() => {
            nextCalled = true;
        }) as NextFunction);
        assert.ok(!nextCalled);
        assert.ok(res.redirectUrl.startsWith("/login?returnTo="));
    });

    it("calls next() without refreshing when token is more than 5 minutes from expiry", async () => {
        const mw = createTokenRefreshMiddleware(neverCalled);
        const req = makeReq({ tokenExpiresAt: Date.now() + HOUR_MS });
        const res = makeRes();
        let nextCalled = false;
        await mw(req, res, (() => {
            nextCalled = true;
        }) as NextFunction);
        assert.ok(nextCalled);
        assert.strictEqual(res.redirectUrl, "");
    });

    it("refreshes token, updates session, and calls next() when token expires within 5 minutes", async () => {
        const newTokens = { accessToken: "new-access", refreshToken: "new-refresh", expiresIn: 604800 };
        const mw = createTokenRefreshMiddleware(async () => newTokens);
        const session = {
            user: { id: "123", username: "testuser", avatar: null as string | null },
            accessToken: "old-access",
            refreshToken: "old-refresh",
            tokenExpiresAt: Date.now() + MIN_MS,
            destroy: (cb: () => void) => cb(),
            save: (cb: (err?: Error) => void) => cb(),
        };
        const req = { path: "/guild-select", session } as unknown as Request;
        const res = makeRes();
        let nextCalled = false;
        await mw(req, res, (() => {
            nextCalled = true;
        }) as NextFunction);
        assert.ok(nextCalled);
        assert.strictEqual(session.accessToken, "new-access");
        assert.strictEqual(session.refreshToken, "new-refresh");
        assert.ok(session.tokenExpiresAt > Date.now() + 604700 * 1000);
        assert.strictEqual(res.redirectUrl, "");
    });

    it("destroys session and redirects when token refresh throws", async () => {
        const mw = createTokenRefreshMiddleware(async () => {
            throw new Error("invalid_grant");
        });
        const req = makeReq({ tokenExpiresAt: Date.now() + MIN_MS });
        const res = makeRes();
        let nextCalled = false;
        await mw(req, res, (() => {
            nextCalled = true;
        }) as NextFunction);
        assert.ok(!nextCalled);
        assert.ok(res.redirectUrl.startsWith("/login?returnTo="));
    });
});
