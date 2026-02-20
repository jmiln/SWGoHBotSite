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
    }
}
