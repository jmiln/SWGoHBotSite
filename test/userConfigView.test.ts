import assert from "node:assert";
import { describe, it } from "node:test";
import { type ArenaPlayer, buildLinkedAccounts, buildWatchAccounts } from "../modules/users.ts";

function players(...entries: ArenaPlayer[]): Map<number, ArenaPlayer> {
    return new Map(entries.map((p) => [p.allyCode, p]));
}

describe("buildLinkedAccounts", () => {
    it("joins names and ranks from arenaPlayers and marks the primary account", () => {
        const result = buildLinkedAccounts(
            [111, 222],
            222,
            players(
                { allyCode: 111, name: "Zebra", lastCharRank: 5, lastShipRank: 9 },
                { allyCode: 222, name: "Alpha", lastCharRank: 1 },
            ),
        );
        // Sorted by name: Alpha before Zebra
        assert.deepEqual(
            result.map((a) => a.allyCode),
            [222, 111],
        );
        assert.equal(result[0].primary, true);
        assert.equal(result[1].primary, false);
        assert.equal(result[0].lastShipRank, undefined);
        assert.equal(result[1].lastCharRank, 5);
    });

    it("falls back to the ally code for sorting and leaves name undefined when no player doc exists", () => {
        const result = buildLinkedAccounts([999], null, players());
        assert.equal(result.length, 1);
        assert.equal(result[0].allyCode, 999);
        assert.equal(result[0].name, undefined);
        assert.equal(result[0].primary, false);
    });
});

describe("buildWatchAccounts", () => {
    it("joins player data and retains the payout offset from the watch entry", () => {
        const result = buildWatchAccounts(
            [
                { allyCode: 111, poOffset: 120 },
                { allyCode: 222, poOffset: 60 },
            ],
            players(
                { allyCode: 111, name: "Zebra", lastCharRank: 3, lastShipRank: 4 },
                { allyCode: 222, name: "Alpha", lastCharRank: 7 },
            ),
        );
        assert.deepEqual(
            result.map((a) => a.allyCode),
            [222, 111],
        );
        assert.equal(result[0].poOffset, 60);
        assert.equal(result[1].lastShipRank, 4);
    });

    it("handles a watch entry whose player doc is missing", () => {
        const result = buildWatchAccounts([{ allyCode: 555, poOffset: 0 }], players());
        assert.equal(result[0].allyCode, 555);
        assert.equal(result[0].name, undefined);
    });
});
