import type { Request } from "express";
import type { infer as ZInfer } from "zod";
import * as auth from "./auth.ts";
import { parseEventDateTime } from "./eventDateTime.ts";
import type { GuildEventFormSchema } from "./formSchemas.ts";
import type { GuildConfig } from "./guilds.ts";

export const GUILD_CACHE_TTL_MS = 5 * 60 * 1000;

export async function getCachedUserGuilds(req: Request, accessToken: string): Promise<auth.DiscordGuild[]> {
    const cached = req.session.cachedGuilds;
    if (cached && cached.expiresAt > Date.now()) {
        return cached.guilds as auth.DiscordGuild[];
    }
    const guilds = await auth.fetchUserGuilds(accessToken);
    req.session.cachedGuilds = { guilds, expiresAt: Date.now() + GUILD_CACHE_TTL_MS };
    return guilds;
}

export async function canAccessGuild(
    accessToken: string,
    guildId: string,
    discordPermissions: string,
    adminRoles: string[],
): Promise<boolean> {
    if (BigInt(discordPermissions) & 32n) return true;
    try {
        const member = await auth.fetchGuildMember(accessToken, guildId);
        return member.roles.some((r) => adminRoles.includes(r));
    } catch {
        return false;
    }
}

export function buildEventFromForm(body: ZInfer<typeof GuildEventFormSchema>): NonNullable<GuildConfig["events"]>[number] {
    const event: NonNullable<GuildConfig["events"]>[number] = { name: body.name };
    const eventTimestamp = parseEventDateTime(body.eventDT, body.eventDTUtc);
    if (eventTimestamp !== null) event.eventDT = eventTimestamp;
    if (body.channel) event.channel = body.channel;
    event.countdown = body.countdown === "on";
    if (body.message?.trim()) event.message = body.message.trim();
    const rd = body.repeatDay;
    const rh = body.repeatHour;
    const rm = body.repeatMin;
    if (rd || rh || rm) event.repeat = { repeatDay: rd ?? 0, repeatHour: rh ?? 0, repeatMin: rm ?? 0 };
    if (body.repeatDays?.trim()) {
        const nums = body.repeatDays
            .split(",")
            .map((s) => Number.parseInt(s.trim(), 10))
            .filter((n) => n > 0);
        if (nums.length) event.repeatDays = nums;
    }
    return event;
}
