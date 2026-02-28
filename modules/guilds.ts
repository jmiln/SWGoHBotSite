import { defaultGuildSettings } from "./botSchemas.ts";
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

function arraysEqual(a: unknown[], b: unknown[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Computes which settings differ from the bot's defaults so we can $set or $unset them
// in MongoDB rather than overwriting the full document. Only keys present in
// defaultGuildSettings are considered — fields without a default (e.g. twList, aliases)
// are left untouched by this function and must be managed separately.
export function diffFromDefaults(settings: Partial<GuildConfig["settings"]>): {
    set: Partial<GuildConfig["settings"]>;
    unset: (keyof GuildConfig["settings"])[];
} {
    const set: Record<string, unknown> = {};
    const unset: (keyof GuildConfig["settings"])[] = [];

    for (const key of Object.keys(defaultGuildSettings) as (keyof GuildConfig["settings"])[]) {
        const newVal = settings[key];
        if (newVal === undefined) continue;

        const defaultVal = defaultGuildSettings[key];

        if (Array.isArray(defaultVal) && Array.isArray(newVal)) {
            if (arraysEqual(defaultVal, newVal as unknown[])) {
                unset.push(key);
            } else {
                set[key] = newVal;
            }
        } else if (defaultVal === newVal) {
            unset.push(key);
        } else {
            set[key] = newVal;
        }
    }

    return { set: set as Partial<GuildConfig["settings"]>, unset };
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

export async function updateGuildEvents(guildId: string, events: GuildConfig["events"]): Promise<void> {
    const db = getBotDB();
    await db.collection<GuildConfig>("guildConfigs").updateOne({ guildId }, { $set: { events } });
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
