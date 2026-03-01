import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { closeDB, connectDB, getBotDB } from "../modules/db.ts";
import {
    diffFromDefaults,
    getGuildConfig,
    getGuildConfigs,
    updateGuildEvents,
    updateGuildSettings,
} from "../modules/guilds.ts";

const GUILD_A = "guild-aaa-111";
const GUILD_B = "guild-bbb-222";

describe("guilds", () => {
    before(async () => {
        await connectDB();
        const col = getBotDB().collection("guildConfigs");
        await col.insertMany([
            { guildId: GUILD_A, settings: { timezone: "Europe/London", language: "de_DE" }, events: [] },
            { guildId: GUILD_B, settings: {}, events: [{ name: "TW", eventDT: 1700000000 }] },
        ]);
    });

    after(async () => {
        await getBotDB().collection("guildConfigs").drop();
        await closeDB();
    });

    describe("diffFromDefaults", () => {
        it("value matching default appears in unset", () => {
            const { set, unset } = diffFromDefaults({ timezone: "America/New_York" });
            assert.ok(!Object.prototype.hasOwnProperty.call(set, "timezone"));
            assert.ok(unset.includes("timezone"));
        });

        it("value differing from default appears in set", () => {
            const { set, unset } = diffFromDefaults({ timezone: "Europe/Berlin" });
            assert.strictEqual(set.timezone, "Europe/Berlin");
            assert.ok(!unset.includes("timezone"));
        });

        it("array matching default appears in unset", () => {
            const { set, unset } = diffFromDefaults({ eventCountdown: [24, 2, 1] });
            assert.ok(!Object.prototype.hasOwnProperty.call(set, "eventCountdown"));
            assert.ok(unset.includes("eventCountdown"));
        });

        it("array differing from default appears in set", () => {
            const { set, unset } = diffFromDefaults({ eventCountdown: [12, 1] });
            assert.deepStrictEqual(set.eventCountdown, [12, 1]);
            assert.ok(!unset.includes("eventCountdown"));
        });

        it("undefined value is absent from both set and unset", () => {
            const { set, unset } = diffFromDefaults({ timezone: undefined });
            assert.ok(!Object.prototype.hasOwnProperty.call(set, "timezone"));
            assert.ok(!unset.includes("timezone"));
        });
    });

    describe("getGuildConfig", () => {
        it("returns null for a non-existent guildId", async () => {
            const result = await getGuildConfig("does-not-exist");
            assert.strictEqual(result, null);
        });

        it("returns the seeded document for a known guildId", async () => {
            const result = await getGuildConfig(GUILD_A);
            assert.ok(result !== null);
            assert.strictEqual(result.guildId, GUILD_A);
            assert.strictEqual(result.settings.timezone, "Europe/London");
        });
    });

    describe("getGuildConfigs", () => {
        it("returns [] when no IDs match", async () => {
            const result = await getGuildConfigs(["no-match-1", "no-match-2"]);
            assert.deepStrictEqual(result, []);
        });

        it("returns matching configs for known IDs", async () => {
            const result = await getGuildConfigs([GUILD_A, GUILD_B]);
            const ids = result.map((g) => g.guildId);
            assert.ok(ids.includes(GUILD_A));
            assert.ok(ids.includes(GUILD_B));
        });

        it("does not return configs for non-matching IDs", async () => {
            const result = await getGuildConfigs([GUILD_A, "non-existent"]);
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].guildId, GUILD_A);
        });
    });

    describe("updateGuildSettings", () => {
        it("$set fields are stored under settings.<key>", async () => {
            await updateGuildSettings(GUILD_A, { language: "ko_KR" });
            const doc = await getGuildConfig(GUILD_A);
            assert.strictEqual(doc?.settings.language, "ko_KR");
        });

        it("$unset removes a settings field", async () => {
            // Confirm the field exists first
            const before = await getGuildConfig(GUILD_A);
            assert.ok(before?.settings.timezone !== undefined);

            await updateGuildSettings(GUILD_A, {}, ["timezone"]);

            const after = await getGuildConfig(GUILD_A);
            assert.strictEqual(after?.settings.timezone, undefined);
        });

        it("no-op (empty set + no unset) does not error", async () => {
            await assert.doesNotReject(() => updateGuildSettings(GUILD_A, {}));
        });
    });

    describe("updateGuildEvents", () => {
        it("replaces the events array", async () => {
            const newEvents = [{ name: "GAC", eventDT: 1800000000 }];
            await updateGuildEvents(GUILD_B, newEvents);
            const doc = await getGuildConfig(GUILD_B);
            assert.strictEqual(doc?.events?.length, 1);
            assert.strictEqual(doc?.events?.[0].name, "GAC");
        });
    });
});
