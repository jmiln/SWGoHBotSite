import type { Request, RequestHandler, Router } from "express";

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
    partialsPath: string;
}

export interface PluginNavItem {
    label: string;
    href: string;
    requiresAuth?: boolean;
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
