import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { closeDB, connectDB, getBotDB, getSwapiDB } from "../modules/db.ts";

describe("db", () => {
    before(async () => {
        await connectDB();
    });

    after(async () => {
        await closeDB();
    });

    it("connectDB resolves without throwing", async () => {
        // If we reach this point the before hook succeeded
        assert.ok(true);
    });

    it("getBotDB returns Db with databaseName testBotDB", () => {
        const db = getBotDB();
        assert.strictEqual(db.databaseName, "testBotDB");
    });

    it("getSwapiDB returns Db with databaseName testSwapiDB", () => {
        const db = getSwapiDB();
        assert.strictEqual(db.databaseName, "testSwapiDB");
    });

    it("getBotDB can ping successfully", async () => {
        const db = getBotDB();
        const result = await db.command({ ping: 1 });
        assert.strictEqual(result.ok, 1);
    });

    it("getSwapiDB can ping successfully", async () => {
        const db = getSwapiDB();
        const result = await db.command({ ping: 1 });
        assert.strictEqual(result.ok, 1);
    });
});
