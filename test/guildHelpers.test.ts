import assert from "node:assert";
import { afterEach, describe, it, mock, test } from "node:test";
import type { Request } from "express";
import { buildEventFromForm, canAccessGuild, getCachedUserGuilds } from "../modules/guildHelpers.ts";

type FakeGuild = { id: string; name: string; icon: string | null; permissions: string };
type FakeSession = { cachedGuilds?: { guilds: FakeGuild[]; expiresAt: number } };

function makeReq(session: FakeSession = {}): Request {
    return { session } as unknown as Request;
}

// --- getCachedUserGuilds ---

describe("getCachedUserGuilds", () => {
    afterEach(() => mock.restoreAll());

    const fakeGuilds: FakeGuild[] = [{ id: "111", name: "Guild A", permissions: "0", icon: null }];

    it("fetches from Discord and caches when no cached guilds present", async () => {
        mock.method(globalThis, "fetch", async () => ({
            ok: true,
            json: async () => fakeGuilds,
        }));
        const session: FakeSession = {};
        const req = makeReq(session);
        const result = await getCachedUserGuilds(req, "my-token");
        assert.deepStrictEqual(result, fakeGuilds);
        assert.deepStrictEqual(session.cachedGuilds?.guilds, fakeGuilds);
        assert.ok((session.cachedGuilds?.expiresAt ?? 0) > Date.now());
    });

    it("returns cached guilds without fetching when cache is still fresh", async () => {
        mock.method(globalThis, "fetch", async () => {
            throw new Error("fetch should not be called");
        });
        const session: FakeSession = { cachedGuilds: { guilds: fakeGuilds, expiresAt: Date.now() + 10_000 } };
        const req = makeReq(session);
        const result = await getCachedUserGuilds(req, "my-token");
        assert.deepStrictEqual(result, fakeGuilds);
    });

    it("re-fetches and updates cache when cache has expired", async () => {
        const freshGuilds: FakeGuild[] = [{ id: "222", name: "Guild B", permissions: "32", icon: null }];
        mock.method(globalThis, "fetch", async () => ({
            ok: true,
            json: async () => freshGuilds,
        }));
        const session: FakeSession = { cachedGuilds: { guilds: fakeGuilds, expiresAt: Date.now() - 1 } };
        const req = makeReq(session);
        const result = await getCachedUserGuilds(req, "my-token");
        assert.deepStrictEqual(result, freshGuilds);
        assert.deepStrictEqual(session.cachedGuilds?.guilds, freshGuilds);
    });
});

// --- canAccessGuild ---

describe("canAccessGuild", () => {
    afterEach(() => mock.restoreAll());

    it("returns true immediately when MANAGE_GUILD bit (32) is set in permissions", async () => {
        mock.method(globalThis, "fetch", async () => {
            throw new Error("fetch should not be called");
        });
        assert.strictEqual(await canAccessGuild("token", "guild1", "32", []), true);
    });

    it("returns true when MANAGE_GUILD bit is set alongside other bits", async () => {
        mock.method(globalThis, "fetch", async () => {
            throw new Error("fetch should not be called");
        });
        // 36 = 0b100100 = bits for MANAGE_GUILD (32) + SEND_MESSAGES (4)
        assert.strictEqual(await canAccessGuild("token", "guild1", "36", []), true);
    });

    it("returns false without API call when permissions has no MANAGE_GUILD bit and no admin roles", async () => {
        mock.method(globalThis, "fetch", async () => ({
            ok: true,
            json: async () => ({ roles: [] }),
        }));
        assert.strictEqual(await canAccessGuild("token", "guild1", "4", []), false);
    });

    it("returns true when member has a matching admin role", async () => {
        mock.method(globalThis, "fetch", async () => ({
            ok: true,
            json: async () => ({ roles: ["role-a", "role-b"] }),
        }));
        assert.strictEqual(await canAccessGuild("token", "guild1", "0", ["role-b"]), true);
    });

    it("returns false when member has no matching admin roles", async () => {
        mock.method(globalThis, "fetch", async () => ({
            ok: true,
            json: async () => ({ roles: ["role-x"] }),
        }));
        assert.strictEqual(await canAccessGuild("token", "guild1", "0", ["role-a"]), false);
    });

    it("returns false when fetchGuildMember throws", async () => {
        mock.method(globalThis, "fetch", async () => ({
            ok: false,
            status: 403,
        }));
        assert.strictEqual(await canAccessGuild("token", "guild1", "0", ["role-a"]), false);
    });
});

// --- buildEventFromForm ---

test("buildEventFromForm prefers explicit UTC eventDT when provided", () => {
    const event = buildEventFromForm({
        name: "TB",
        eventDT: "2026-05-06T20:38",
        eventDTUtc: "2026-05-07T03:38:00.000Z",
    });

    assert.strictEqual(event.eventDT, Date.parse("2026-05-07T03:38:00.000Z"));
});

test("buildEventFromForm falls back to raw datetime-local value when UTC eventDT is absent", () => {
    const event = buildEventFromForm({
        name: "TB",
        eventDT: "2026-05-06T20:38",
    });

    assert.strictEqual(event.eventDT, new Date("2026-05-06T20:38").getTime());
});

test("buildEventFromForm sets channel when provided", () => {
    const event = buildEventFromForm({ name: "TB", eventDT: "2026-05-06T20:38", channel: "123456789012345678" });
    assert.strictEqual(event.channel, "123456789012345678");
});

test("buildEventFromForm does not set channel when not provided", () => {
    const event = buildEventFromForm({ name: "TB", eventDT: "2026-05-06T20:38" });
    assert.strictEqual(event.channel, undefined);
});

test("buildEventFromForm sets trimmed message when provided", () => {
    const event = buildEventFromForm({ name: "TB", eventDT: "2026-05-06T20:38", message: "  Hello  " });
    assert.strictEqual(event.message, "Hello");
});

test("buildEventFromForm does not set message when value is blank whitespace", () => {
    const event = buildEventFromForm({ name: "TB", eventDT: "2026-05-06T20:38", message: "   " });
    assert.strictEqual(event.message, undefined);
});

test("buildEventFromForm sets countdown true when countdown is 'on'", () => {
    const event = buildEventFromForm({ name: "TB", eventDT: "2026-05-06T20:38", countdown: "on" });
    assert.strictEqual(event.countdown, true);
});

test("buildEventFromForm sets countdown false when countdown is not 'on'", () => {
    const event = buildEventFromForm({ name: "TB", eventDT: "2026-05-06T20:38" });
    assert.strictEqual(event.countdown, false);
});

test("buildEventFromForm sets repeat when repeatDay/Hour/Min are provided", () => {
    const event = buildEventFromForm({ name: "TB", eventDT: "2026-05-06T20:38", repeatDay: 7, repeatHour: 0, repeatMin: 30 });
    assert.deepStrictEqual(event.repeat, { repeatDay: 7, repeatHour: 0, repeatMin: 30 });
});

test("buildEventFromForm does not set repeat when no repeat fields are provided", () => {
    const event = buildEventFromForm({ name: "TB", eventDT: "2026-05-06T20:38" });
    assert.strictEqual(event.repeat, undefined);
});

test("buildEventFromForm sets repeatDays from comma-separated positive integers", () => {
    const event = buildEventFromForm({
        name: "TB",
        eventDT: "2026-05-06T20:38",
        repeatDays: "1, 3, 7",
    });
    assert.deepStrictEqual(event.repeatDays, [1, 3, 7]);
});

test("buildEventFromForm filters out zero and negative values in repeatDays", () => {
    const event = buildEventFromForm({
        name: "TB",
        eventDT: "2026-05-06T20:38",
        repeatDays: "0, -5, 3",
    });
    assert.deepStrictEqual(event.repeatDays, [3]);
});

test("buildEventFromForm does not set repeatDays when all values are non-positive", () => {
    const event = buildEventFromForm({
        name: "TB",
        eventDT: "2026-05-06T20:38",
        repeatDays: "0, -1",
    });
    assert.strictEqual(event.repeatDays, undefined);
});

test("buildEventFromForm does not set repeatDays when string is blank", () => {
    const event = buildEventFromForm({
        name: "TB",
        eventDT: "2026-05-06T20:38",
        repeatDays: "   ",
    });
    assert.strictEqual(event.repeatDays, undefined);
});
