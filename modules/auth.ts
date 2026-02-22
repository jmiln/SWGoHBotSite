import { env } from "./env.ts";

const DISCORD_API_BASE = "https://discord.com/api/v10";

export function buildDiscordAuthURL(state: string): string {
    const params = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        redirect_uri: env.DISCORD_REDIRECT_URI,
        response_type: "code",
        scope: "identify guilds guilds.members.read",
        state,
    });
    return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<{ accessToken: string; expiresIn: number }> {
    const params = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: env.DISCORD_REDIRECT_URI,
    });

    const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Token exchange failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export interface DiscordUser {
    id: string;
    username: string;
    avatar: string | null;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
    const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch Discord user (${response.status})`);
    }

    return response.json() as Promise<DiscordUser>;
}

export interface DiscordGuild {
    id: string;
    name: string;
    icon: string | null;
    permissions: string;
}

export async function fetchUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
    const response = await fetch(`${DISCORD_API_BASE}/users/@me/guilds`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch user guilds (${response.status})`);
    }

    return response.json() as Promise<DiscordGuild[]>;
}

export interface GuildMember {
    roles: string[];
}

export async function fetchGuildMember(accessToken: string, guildId: string): Promise<GuildMember> {
    const response = await fetch(`${DISCORD_API_BASE}/users/@me/guilds/${guildId}/member`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch guild member (${response.status})`);
    }

    return response.json() as Promise<GuildMember>;
}
