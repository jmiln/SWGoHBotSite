import { getBotDB } from "./db.ts";

export interface UserAccount {
    allyCode: string;
    name: string;
    primary: boolean;
    lastCharRank?: number;
    lastShipRank?: number;
}

export interface ArenaWatchAccount {
    allyCode?: number;
    allycode?: number;
    name: string;
    lastChar: number;
    lastShip: number;
    poOffset: number;
}

export interface UserConfig {
    id: string;
    patreonAmountCents?: number;
    accounts: UserAccount[];
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
        allycodes: ArenaWatchAccount[];
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

export { getUser, updateUser };
