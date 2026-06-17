import { getBotDB } from "./db.ts";

// Per-player arena data lives in the dedicated `arenaPlayers` collection (keyed by allyCode),
// not on the user document. See the bot's schemas/arenaPlayers.schema.ts and SCHEMAS.md.
export interface ArenaPlayer {
    allyCode: number;
    name: string;
    lastCharRank?: number;
    lastShipRank?: number;
    lastCharClimb?: number;
    lastShipClimb?: number;
    lastCharChange?: number;
    lastShipChange?: number;
}

// Lean arenaWatch entry as stored on the user document. Name/ranks moved to `arenaPlayers`.
export interface ArenaWatchAccount {
    allyCode: number;
    mention?: string | null;
    poOffset?: number;
    mark?: string | null;
    warn?: { min?: number; arena?: string };
    result?: string;
}

// View models built for the /config page by joining ally codes against `arenaPlayers`.
export interface LinkedAccountView {
    allyCode: number;
    name?: string;
    lastCharRank?: number;
    lastShipRank?: number;
    primary: boolean;
}

export interface WatchAccountView {
    allyCode: number;
    name?: string;
    lastCharRank?: number;
    lastShipRank?: number;
    poOffset?: number;
}

export interface UserConfig {
    id: string;
    patreonAmountCents?: number;
    accounts: number[];
    primaryAllyCode?: number | null;
    lang: {
        language?: string;
        swgohLanguage?: string;
    };
    arenaAlert: {
        enableRankDMs: string;
        arena: string;
        payoutWarning: number;
        enablePayoutResult: boolean;
    };
    arenaWatch: {
        enabled: boolean;
        allyCodes: ArenaWatchAccount[];
        channel?: string;
        arena?: {
            char?: { channel: string; enabled: boolean };
            fleet?: { channel: string; enabled: boolean };
        };
        payout?: {
            char?: { enabled: boolean; channel: string; msgID: string };
            fleet?: { enabled: boolean; channel: string; msgID: string };
        };
        useEmotesInLog?: boolean;
        useMarksInLog?: boolean;
        report: string;
        showvs: boolean;
    };
    guildUpdate: {
        enabled: boolean;
        channel?: string;
        allycode: number;
        sortBy: string;
    };
    guildTickets: {
        enabled: boolean;
        channel?: string;
        allyCode?: number;
        sortBy: string;
        msgId?: string;
        tickets?: number;
        updateType?: string;
        showMax: boolean;
    };
}

async function getUser(discordId: string): Promise<UserConfig | null> {
    const db = getBotDB();
    const user = await db.collection("users").findOne({ id: discordId });
    return user as UserConfig | null;
}

async function updateUser(discordId: string, config: Partial<UserConfig>): Promise<void> {
    const db = getBotDB();
    await db.collection("users").updateOne({ id: discordId }, { $set: config }, { upsert: false });
}

/**
 * Fetch arena player documents for the given ally codes in a single query, returned as a
 * Map keyed by allyCode. Ally codes without a matching `arenaPlayers` doc are simply absent.
 */
async function getArenaPlayers(allyCodes: number[]): Promise<Map<number, ArenaPlayer>> {
    const map = new Map<number, ArenaPlayer>();
    if (!allyCodes.length) return map;
    const db = getBotDB();
    const docs = await db
        .collection("arenaPlayers")
        .find({ allyCode: { $in: allyCodes } })
        .toArray();
    for (const doc of docs) {
        const player = doc as unknown as ArenaPlayer;
        map.set(player.allyCode, player);
    }
    return map;
}

/** Case-insensitive sort key, falling back to the ally code when a player has no name. */
function nameSortKey(name: string | undefined, allyCode: number): string {
    return (name ?? String(allyCode)).toLowerCase();
}

/**
 * Join registered ally codes against their `arenaPlayers` docs, mark the primary account,
 * and sort by display name (ally code as fallback).
 */
function buildLinkedAccounts(
    accounts: number[],
    primaryAllyCode: number | null | undefined,
    players: Map<number, ArenaPlayer>,
): LinkedAccountView[] {
    return accounts
        .map((allyCode) => {
            const player = players.get(allyCode);
            return {
                allyCode,
                name: player?.name,
                lastCharRank: player?.lastCharRank,
                lastShipRank: player?.lastShipRank,
                primary: allyCode === primaryAllyCode,
            };
        })
        .sort((a, b) => nameSortKey(a.name, a.allyCode).localeCompare(nameSortKey(b.name, b.allyCode)));
}

/**
 * Join arenaWatch entries against their `arenaPlayers` docs, retaining the per-entry payout
 * offset, and sort by display name (ally code as fallback).
 */
function buildWatchAccounts(watchEntries: ArenaWatchAccount[], players: Map<number, ArenaPlayer>): WatchAccountView[] {
    return watchEntries
        .map((entry) => {
            const player = players.get(entry.allyCode);
            return {
                allyCode: entry.allyCode,
                name: player?.name,
                lastCharRank: player?.lastCharRank,
                lastShipRank: player?.lastShipRank,
                poOffset: entry.poOffset,
            };
        })
        .sort((a, b) => nameSortKey(a.name, a.allyCode).localeCompare(nameSortKey(b.name, b.allyCode)));
}

export { buildLinkedAccounts, buildWatchAccounts, getArenaPlayers, getUser, updateUser };
