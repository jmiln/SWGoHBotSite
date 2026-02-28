import { z } from "zod";

export const LangFormSchema = z.object({
    language: z.enum(["en_US", "de_DE", "es_SP", "ko_KR", "pt_BR"]).optional(),
    swgohLanguage: z
        .enum([
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
        ])
        .optional(),
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

const VALID_TIMEZONES = Intl.supportedValuesOf("timeZone");

export const GuildSettingsFormSchema = z.object({
    language: z.enum(["en_US", "de_DE", "es_SP", "ko_KR", "pt_BR"]).optional(),
    swgohLanguage: z
        .enum([
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
        ])
        .optional(),
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
        .superRefine((val, ctx) => {
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
            }
        })
        .transform((val) =>
            val
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .map(Number),
        )
        .optional(),
    enableWelcome: z.boolean().optional(),
    welcomeMessage: z.string().max(1000).optional(),
    enablePart: z.boolean().optional(),
    partMessage: z.string().max(1000).optional(),
});
