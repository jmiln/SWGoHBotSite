import assert from "node:assert";
import { describe, it } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { requireGuildAccess } from "../middleware/requireGuildAccess.ts";

function makeReq(session: Record<string, unknown>): Request {
    return { session, params: { id: "123" }, originalUrl: "/guild/123/edit" } as unknown as Request;
}

function makeRes() {
    const res = { redirectedTo: null as string | null, redirect: (url: string) => (res.redirectedTo = url) };
    return res;
}

describe("requireGuildAccess without a usable session", () => {
    const cases: [string, Record<string, unknown>][] = [
        ["no logged-in user", {}],
        ["a user but no access token", { user: { id: "1", username: "u", avatar: null } }],
    ];
    for (const [label, session] of cases) {
        it(`redirects to login instead of continuing when there is ${label}`, async () => {
            const res = makeRes();
            let nextCalled = false;
            const next: NextFunction = () => {
                nextCalled = true;
            };

            await requireGuildAccess(makeReq(session), res as unknown as Response, next);

            assert.strictEqual(nextCalled, false, "next() must not be called");
            assert.strictEqual(res.redirectedTo, `/login?returnTo=${encodeURIComponent("/guild/123/edit")}`);
        });
    }
});
