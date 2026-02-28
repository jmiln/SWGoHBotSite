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

export async function updateGuildSettings(
    guildId: string,
    set: Partial<GuildConfig["settings"]>,
    unset?: (keyof GuildConfig["settings"])[],
): Promise<void> {
    const db = getBotDB();
    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(set)) {
        setFields[`settings.${key}`] = value;
    }
    const updateOp: Record<string, unknown> = {};
    if (Object.keys(setFields).length) updateOp.$set = setFields;
    if (unset?.length) {
        const unsetFields: Record<string, 1> = {};
        for (const key of unset) unsetFields[`settings.${key}`] = 1;
        updateOp.$unset = unsetFields;
    }
    if (Object.keys(updateOp).length) {
        await db.collection<GuildConfig>("guildConfigs").updateOne({ guildId }, updateOp);
    }
}
