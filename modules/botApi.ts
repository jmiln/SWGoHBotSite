import { env } from "./env.ts";

const DISCORD_API_BASE = "https://discord.com/api/v10";

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
        });

        if (!response.ok) {
            return [];
        }

        const data = (await response.json()) as Array<{ id: string; name: string }>;
        return data.map((c) => ({ id: c.id, name: c.name }));
    } catch {
        return [];
    }
}
