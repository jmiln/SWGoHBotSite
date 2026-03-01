import assert from "node:assert";
import { test } from "node:test";
import type { Request } from "express";
import { generateCsrfToken, rotateCsrfToken, verifyCsrfToken } from "../modules/csrf.ts";

// Minimal mock of Express Request with session + body
function makeReq(bodyToken?: string) {
    return { session: {} as Record<string, unknown>, body: { _csrf: bodyToken } } as unknown as Request;
}

test("generateCsrfToken creates a 64-char hex token", () => {
    const req = makeReq();
    const token = generateCsrfToken(req);
    assert.match(token, /^[0-9a-f]{64}$/);
});

test("generateCsrfToken returns the same token on repeat calls", () => {
    const req = makeReq();
    assert.strictEqual(generateCsrfToken(req), generateCsrfToken(req));
});

test("rotateCsrfToken returns a new 64-char hex token", () => {
    const req = makeReq();
    const newToken = rotateCsrfToken(req);
    assert.match(newToken, /^[0-9a-f]{64}$/);
});

test("rotateCsrfToken produces a different token than the previous one", () => {
    const req = makeReq();
    const old = generateCsrfToken(req);
    const next = rotateCsrfToken(req);
    assert.notStrictEqual(old, next);
});

test("verifyCsrfToken returns false after rotation if old token is submitted", () => {
    const req = makeReq();
    const old = generateCsrfToken(req);
    rotateCsrfToken(req);
    req.body._csrf = old;
    assert.strictEqual(verifyCsrfToken(req), false);
});

test("verifyCsrfToken returns true with rotated token", () => {
    const req = makeReq();
    generateCsrfToken(req);
    const next = rotateCsrfToken(req);
    req.body._csrf = next;
    assert.strictEqual(verifyCsrfToken(req), true);
});

test("verifyCsrfToken returns false when body token is absent", () => {
    const req = makeReq();
    generateCsrfToken(req);
    assert.strictEqual(verifyCsrfToken(req), false);
});
