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
