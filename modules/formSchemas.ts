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
