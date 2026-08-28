import type { Request, RequestHandler, Router } from "express";

/**
 * A Discord guild as returned by the host's guild helper.
 *
 * Declared structurally rather than importing `DiscordGuild` from ../modules/auth.ts on purpose:
 * this file is vendored verbatim into plugin repos, so it must not import anything but express.
 * The shapes are identical, and TypeScript is structural, so the real helper satisfies this.
 */
export interface PluginUserGuild {
    id: string;
    name: string;
    icon: string | null;
    permissions: string;
}

/** The host's cached guild lookup, handed to plugins rather than imported by them. */
export type GetCachedUserGuilds = (req: Request, accessToken: string) => Promise<PluginUserGuild[]>;

export interface PluginContext {
    env: Record<string, string | undefined>;
    logger: {
        log: (msg: string) => void;
        info: (msg: string) => void;
        warn: (msg: string) => void;
        error: (msg: string) => void;
        debug: (msg: string) => void;
    };
    requireAdmin: RequestHandler;
    generateCsrfToken: (req: Request) => string;
    verifyCsrfToken: (req: Request) => boolean;
    getCachedUserGuilds: GetCachedUserGuilds;
    partialsPath: string;
}

export interface PluginNavItem {
    label: string;
    href: string;
    requiresAuth?: boolean;
    /** Show only to the ADMIN_DISCORD_ID user. Pair with `requireAdmin` on the plugin's router. */
    requiresAdmin?: boolean;
}

export interface PluginDefinition {
    mountPath: string;
    router: Router;
    viewPaths?: string[];
    staticDir?: string;
    staticMountPath?: string;
    name: string;
    navItems?: PluginNavItem[];
}

export type PluginFactory = (ctx: PluginContext) => PluginDefinition;
