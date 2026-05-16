import assert from "node:assert";
import { test } from "node:test";
import { GuildEventFormSchema, GuildSettingsFormSchema } from "../modules/formSchemas.ts";

// --- GuildSettingsFormSchema.announceChan (discordSnowflakeOrEmpty) ---

test("announceChan: accepts valid 18-digit snowflake", () => {
    const r = GuildSettingsFormSchema.safeParse({ announceChan: "123456789012345678" });
    assert.ok(r.success, JSON.stringify(r));
});

test("announceChan: accepts empty string and preserves it for diffFromDefaults", () => {
    const r = GuildSettingsFormSchema.safeParse({ announceChan: "" });
    assert.ok(r.success, JSON.stringify(r));
    assert.strictEqual(r.data?.announceChan, "");
});

test("announceChan: accepts 17-digit snowflake (lower boundary)", () => {
    const r = GuildSettingsFormSchema.safeParse({ announceChan: "12345678901234567" });
    assert.ok(r.success, JSON.stringify(r));
});

test("announceChan: accepts 19-digit snowflake (upper boundary)", () => {
    const r = GuildSettingsFormSchema.safeParse({ announceChan: "1234567890123456789" });
    assert.ok(r.success, JSON.stringify(r));
});

test("announceChan: accepts undefined (not provided)", () => {
    const r = GuildSettingsFormSchema.safeParse({});
    assert.ok(r.success, JSON.stringify(r));
});

test("announceChan: rejects channel name string", () => {
    const r = GuildSettingsFormSchema.safeParse({ announceChan: "general" });
    assert.ok(!r.success, "should have failed");
});

test("announceChan: rejects too-short numeric string", () => {
    const r = GuildSettingsFormSchema.safeParse({ announceChan: "12345" });
    assert.ok(!r.success, "should have failed");
});

test("announceChan: rejects 20-digit numeric string (too long)", () => {
    const r = GuildSettingsFormSchema.safeParse({ announceChan: "12345678901234567890" });
    assert.ok(!r.success, "should have failed");
});

// --- GuildSettingsFormSchema.adminRole (array of discordSnowflake) ---

test("adminRole: accepts array of valid snowflakes", () => {
    const r = GuildSettingsFormSchema.safeParse({ adminRole: ["123456789012345678"] });
    assert.ok(r.success, JSON.stringify(r));
});

test("adminRole: accepts empty array (clears roles)", () => {
    const r = GuildSettingsFormSchema.safeParse({ adminRole: [] });
    assert.ok(r.success, JSON.stringify(r));
});

test("adminRole: rejects array containing a name string", () => {
    const r = GuildSettingsFormSchema.safeParse({ adminRole: ["admin"] });
    assert.ok(!r.success, "should have failed");
});

test("adminRole: rejects array mixing valid and invalid", () => {
    const r = GuildSettingsFormSchema.safeParse({ adminRole: ["123456789012345678", "admin"] });
    assert.ok(!r.success, "should have failed");
});

// --- GuildEventFormSchema.channel (discordSnowflake, optional) ---

test("channel: accepts valid snowflake", () => {
    const r = GuildEventFormSchema.safeParse({ name: "Test Event", channel: "123456789012345678" });
    assert.ok(r.success, JSON.stringify(r));
});

test("channel: accepts undefined (not provided)", () => {
    const r = GuildEventFormSchema.safeParse({ name: "Test Event" });
    assert.ok(r.success, JSON.stringify(r));
});

test("channel: rejects channel name string", () => {
    const r = GuildEventFormSchema.safeParse({ name: "Test Event", channel: "general" });
    assert.ok(!r.success, "should have failed");
});

test("channel: rejects empty string", () => {
    const r = GuildEventFormSchema.safeParse({ name: "Test Event", channel: "" });
    assert.ok(!r.success, "should have failed");
});

// --- GuildEventFormSchema.repeatDays refine (non-empty path) ---

test("repeatDays: accepts valid comma-separated positive integers", () => {
    const r = GuildEventFormSchema.safeParse({ name: "Test Event", repeatDays: "1,7,14" });
    assert.ok(r.success, JSON.stringify(r));
});

test("repeatDays: rejects list containing a non-integer string", () => {
    const r = GuildEventFormSchema.safeParse({ name: "Test Event", repeatDays: "1,abc,7" });
    assert.ok(!r.success, "should have failed");
});

test("repeatDays: rejects list containing zero", () => {
    const r = GuildEventFormSchema.safeParse({ name: "Test Event", repeatDays: "0,7" });
    assert.ok(!r.success, "should have failed");
});

// --- GuildSettingsFormSchema.eventCountdown transform ---

test("eventCountdown: parses valid comma-separated positive integers into number array", () => {
    const r = GuildSettingsFormSchema.safeParse({ eventCountdown: "1,7,14" });
    assert.ok(r.success, JSON.stringify(r));
    assert.deepStrictEqual(r.data?.eventCountdown, [1, 7, 14]);
});

test("eventCountdown: rejects list containing a non-integer string and names the invalid value", () => {
    const r = GuildSettingsFormSchema.safeParse({ eventCountdown: "1,abc,7" });
    assert.ok(!r.success, "should have failed");
    assert.ok(
        r.error?.issues.some((i) => i.message.includes('"abc"')),
        `Expected error mentioning "abc", got: ${JSON.stringify(r.error?.issues)}`,
    );
});

test("eventCountdown: rejects list containing zero and names the invalid value", () => {
    const r = GuildSettingsFormSchema.safeParse({ eventCountdown: "0,7" });
    assert.ok(!r.success, "should have failed");
    assert.ok(
        r.error?.issues.some((i) => i.message.includes('"0"')),
        `Expected error mentioning "0", got: ${JSON.stringify(r.error?.issues)}`,
    );
});

test("eventDTUtc: accepts a future UTC timestamp", () => {
    const r = GuildEventFormSchema.safeParse({
        name: "Test Event",
        eventDT: "2026-05-06T20:38",
        eventDTUtc: new Date(Date.now() + 60_000).toISOString(),
    });
    assert.ok(r.success, JSON.stringify(r));
});

test("eventDTUtc: rejects an invalid UTC timestamp", () => {
    const r = GuildEventFormSchema.safeParse({
        name: "Test Event",
        eventDT: "2026-05-06T20:38",
        eventDTUtc: "not-a-date",
    });
    assert.ok(!r.success, "should have failed");
});
