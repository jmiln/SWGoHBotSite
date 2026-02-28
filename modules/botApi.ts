import { env } from "./env.ts";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const DISCORD_API_TIMEOUT_MS = 10_000;

export interface DiscordRole {
    id: string;
    name: string;
}

export interface DiscordChannel {
    id: string;
    name: string;
}

export async function isBotInGuild(guildId: string): Promise<boolean> {
    try {
        const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}`, {
            headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
            signal: AbortSignal.timeout(DISCORD_API_TIMEOUT_MS),
        });
        return response.ok;
    } catch {
        return false;
    }
}

export async function fetchGuildRoles(guildId: string): Promise<DiscordRole[]> {
    try {
        const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, {
            headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
            signal: AbortSignal.timeout(DISCORD_API_TIMEOUT_MS),
        });

        if (!response.ok) {
            return [];
        }

        const data = (await response.json()) as Array<{ id: string; name: string }>;
        return data.map((r) => ({ id: r.id, name: r.name }));
    } catch {
        return [];
    }
}

export async function fetchGuildChannels(guildId: string): Promise<DiscordChannel[]> {
    try {
        const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/channels`, {
            headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
            signal: AbortSignal.timeout(DISCORD_API_TIMEOUT_MS),
        });

        if (!response.ok) {
            return [];
        }

        const data = (await response.json()) as Array<{ id: string; name: string; type: number }>;
        // 0 = GUILD_TEXT, 5 = GUILD_ANNOUNCEMENT
        return data.filter((c) => c.type === 0 || c.type === 5).map((c) => ({ id: c.id, name: c.name }));
    } catch {
        return [];
    }
}
