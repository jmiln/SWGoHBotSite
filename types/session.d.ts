import "express-session";

declare module "express-session" {
    interface SessionData {
        user?: {
            id: string;
            username: string;
            avatar: string | null;
        };
        oauthState?: string;
        returnTo?: string;
        accessToken?: string;
        csrfToken?: string;
        flash?: { type: "success" | "error"; message: string };
        cachedGuilds?: {
            guilds: { id: string; name: string; icon: string | null; permissions: string }[];
            expiresAt: number;
        };
    }
}
