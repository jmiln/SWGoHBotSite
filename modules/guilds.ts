import { getBotDB } from "./db.ts";

export interface GuildConfig {
    guildId: string;
    settings: {
        adminRole?: string[];
        timezone?: string;
        language?: string;
        swgohLanguage?: string;
        useEventPages?: boolean;
        shardtimeVertical?: boolean;
        announceChan?: string;
        eventCountdown?: number[];
        enableWelcome?: boolean;
        welcomeMessage?: string;
        enablePart?: boolean;
        partMessage?: string;
        twList?: {
            light?: string[];
            dark?: string[];
        };
        aliases?: Record<string, string>;
    };
    events?: Array<{
        name: string;
        eventDT?: number;
        message?: string;
        channel?: string;
        countdown?: boolean | null;
        repeat?: { repeatDay: number; repeatHour: number; repeatMin: number };
        repeatDays?: number[];
    }>;
}

export async function getGuildConfigs(guildIds: string[]): Promise<GuildConfig[]> {
    const db = getBotDB();
    return db
        .collection<GuildConfig>("guildConfigs")
        .find({ guildId: { $in: guildIds } })
        .toArray();
}

export async function getGuildConfig(guildId: string): Promise<GuildConfig | null> {
    const db = getBotDB();
    return db.collection<GuildConfig>("guildConfigs").findOne({ guildId });
}
