import { z } from "zod";

const languageEnum = z.enum(["en_US", "de_DE", "es_SP", "ko_KR", "pt_BR"]);

const swgohLanguageEnum = z.enum([
    "ENG_US",
    "GER_DE",
    "SPA_XM",
    "FRE_FR",
    "RUS_RU",
    "POR_BR",
    "KOR_KR",
    "ITA_IT",
    "TUR_TR",
    "CHS_CN",
    "CHT_CN",
    "IND_ID",
    "JPN_JP",
    "THA_TH",
]);

export const LangFormSchema = z.object({
    language: languageEnum.optional(),
    swgohLanguage: swgohLanguageEnum.optional(),
});

export const ArenaAlertFormSchema = z.object({
    enableRankDMs: z.enum(["all", "primary", "off"]).optional(),
    arena: z.enum(["char", "fleet", "both", "none"]).optional(),
    payoutWarning: z.coerce.number().int().min(0).max(60).optional(),
    enablePayoutResult: z.boolean().optional(),
});

export const ArenaWatchFormSchema = z.object({
    enabled: z.boolean(),
    report: z.enum(["climb", "drop", "both"]).optional(),
    showvs: z.boolean(),
});

export const GuildUpdateFormSchema = z.object({
    enabled: z.boolean(),
});

export const GuildTicketsFormSchema = z.object({
    enabled: z.boolean(),
    sortBy: z.enum(["tickets", "name"]).optional(),
    showMax: z.boolean(),
});

export const GuildEventFormSchema = z
    .object({
        name: z.string().min(1).max(100),
        eventDT: z.string().optional(),
        channel: z.string().optional(),
        countdown: z.string().optional(),
        message: z.string().max(1000).optional(),
        repeatDay: z.coerce.number().int().min(0).optional(),
        repeatHour: z.coerce.number().int().min(0).optional(),
        repeatMin: z.coerce.number().int().min(0).optional(),
        repeatDays: z.string().optional(),
    })
    .refine(
        (data) => {
            const hasInterval = data.repeatDay || data.repeatHour || data.repeatMin;
            const hasDays = data.repeatDays?.trim();
            return !(hasInterval && hasDays);
        },
        { message: "Cannot set both Repeat Interval and Repeat Days. Use only one repeat type." },
    )
    .refine(
        (data) => {
            if (!data.eventDT) return true;
            return new Date(data.eventDT).getTime() > Date.now();
        },
        { message: "Event date and time must be in the future." },
    );

const VALID_TIMEZONES = Intl.supportedValuesOf("timeZone");

export const GuildSettingsFormSchema = z.object({
    language: languageEnum.optional(),
    swgohLanguage: swgohLanguageEnum.optional(),
    timezone: z
        .string()
        .refine((tz) => VALID_TIMEZONES.includes(tz), { message: "Invalid timezone" })
        .optional(),
    useEventPages: z.boolean().optional(),
    shardtimeVertical: z.boolean().optional(),
    announceChan: z.string().optional(),
    adminRole: z.array(z.string()).optional(),
    eventCountdown: z
        .string()
        .transform((val, ctx) => {
            const parts = val
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            const invalid = parts.filter((s) => !/^\d+$/.test(s) || Number(s) <= 0);
            if (invalid.length > 0) {
                ctx.addIssue({
                    code: "custom",
                    message: `Invalid values: ${invalid.map((s) => `"${s}"`).join(", ")}. Use positive integers only.`,
                });
                return z.NEVER;
            }
            return parts.map(Number);
        })
        .optional(),
    enableWelcome: z.boolean().optional(),
    welcomeMessage: z.string().max(1000).optional(),
    enablePart: z.boolean().optional(),
    partMessage: z.string().max(1000).optional(),
});
