import assert from "node:assert";
import { test } from "node:test";
import type { NextFunction, Request, Response } from "express";

// Set all required env vars before importing anything that loads env.ts
process.env.ADMIN_DISCORD_ID = "111111111111111111";
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

const { requireAdmin } = await import("../../middleware/admin.ts");

function makeReq(userId?: string): Request {
    return { session: { user: userId ? { id: userId } : undefined } } as unknown as Request;
}

function makeRes(): Response & { statusCode: number } {
    const res = {
        statusCode: 200,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        render(_view: string, _locals?: Record<string, unknown>) {
            return this;
        },
    };
    return res as unknown as Response & { statusCode: number };
}

test("requireAdmin calls next() when user ID matches ADMIN_DISCORD_ID", (_t, done) => {
    const req = makeReq("111111111111111111");
    const res = makeRes();
    const next: NextFunction = () => {
        done();
    };
    requireAdmin(req, res, next);
});

test("requireAdmin returns 403 when user is not logged in", () => {
    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = () => {
        throw new Error("next should not be called");
    };
    requireAdmin(req, res, next);
    assert.strictEqual(res.statusCode, 403);
});

test("requireAdmin returns 403 when user ID does not match", () => {
    const req = makeReq("999999999999999999");
    const res = makeRes();
    const next: NextFunction = () => {
        throw new Error("next should not be called");
    };
    requireAdmin(req, res, next);
    assert.strictEqual(res.statusCode, 403);
});
