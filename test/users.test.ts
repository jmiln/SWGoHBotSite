import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { closeDB, connectDB, getBotDB } from "../modules/db.ts";
import { getUser, updateUser } from "../modules/users.ts";

const DISCORD_ID = "user-discord-123";

describe("users", () => {
    before(async () => {
        await connectDB();
        await getBotDB().collection("users").insertOne({
            id: DISCORD_ID,
            patreonAmountCents: 0,
            accounts: [],
            lang: { language: "en_US" },
            arenaAlert: { enableRankDMs: "off", arena: "none", payoutWarning: 0, enablePayoutResult: false },
            arenaWatch: { enabled: false, allyCodes: [], report: "both", showvs: false },
            guildUpdate: { enabled: false, allycode: 0, sortBy: "name" },
            guildTickets: { enabled: false, sortBy: "name", showMax: false },
        });
    });

    after(async () => {
        await getBotDB().collection("users").drop();
        await closeDB();
    });

    describe("getUser", () => {
        it("returns null for a non-existent Discord ID", async () => {
            const result = await getUser("no-such-user");
            assert.strictEqual(result, null);
        });

        it("returns the correct document for a known ID", async () => {
            const result = await getUser(DISCORD_ID);
            assert.ok(result !== null);
            assert.strictEqual(result.id, DISCORD_ID);
            assert.strictEqual(result.lang.language, "en_US");
        });
    });

    describe("updateUser", () => {
        it("partial update only changes specified fields", async () => {
            await updateUser(DISCORD_ID, { lang: { language: "de_DE" } });
            const result = await getUser(DISCORD_ID);
            assert.strictEqual(result?.lang.language, "de_DE");
            // Other fields remain untouched
            assert.ok(Array.isArray(result?.accounts));
        });

        it("does not upsert for a non-existent ID", async () => {
            await updateUser("ghost-user", { lang: { language: "en_US" } });
            const result = await getUser("ghost-user");
            assert.strictEqual(result, null);
        });
    });
});
