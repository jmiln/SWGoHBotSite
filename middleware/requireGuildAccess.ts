import type { NextFunction, Request, Response } from "express";
import type { DiscordGuild } from "../modules/auth.ts";
import { canAccessGuild, getCachedUserGuilds } from "../modules/guildHelpers.ts";
import type { GuildConfig } from "../modules/guilds.ts";
import { getGuildConfig } from "../modules/guilds.ts";
import logger from "../modules/logger.ts";

export interface GuildLocals {
    guildId: string;
    guild: DiscordGuild;
    config: GuildConfig | null;
}

export async function requireGuildAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
    const accessToken = req.session.accessToken;
    if (!req.session.user || !accessToken) {
        next();
        return;
    }

    const guildId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
        const [config, guilds] = await Promise.all([getGuildConfig(guildId), getCachedUserGuilds(req, accessToken)]);

        const guild = guilds.find((g) => g.id === guildId);
        if (!guild) {
            res.status(403).render("pages/403");
            return;
        }

        const adminRoles = config?.settings?.adminRole ?? [];
        const allowed = await canAccessGuild(accessToken, guildId, guild.permissions, adminRoles);
        if (!allowed) {
            res.status(403).render("pages/403");
            return;
        }

        res.locals.guildId = guildId;
        res.locals.guild = guild;
        res.locals.config = config;
        next();
    } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("401")) {
            req.session.returnTo = req.originalUrl;
            res.redirect("/login");
            return;
        }
        logger.error(`Guild access check error: ${err}`);
        next(err);
    }
}
