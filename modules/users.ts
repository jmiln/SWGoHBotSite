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
        report: string;
        showvs: boolean;
    };
    guildUpdate: {
        enabled: boolean;
        allycode: number;
        sortBy: string;
    };
    guildTickets: {
        enabled: boolean;
        sortBy: string;
        showMax: boolean;
    };
}

async function getUser(discordId: string): Promise<UserConfig | null> {
    const db = getBotDB();
    const user = await db.collection("users").findOne({ id: discordId });
    return user as UserConfig | null;
}

export { getUser };
