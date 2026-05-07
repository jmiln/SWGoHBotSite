import type { Request, Response } from "express";
import { Router } from "express";
import type * as auth from "../modules/auth.ts";
import * as botApi from "../modules/botApi.ts";
import { canAccessGuild, getCachedUserGuilds } from "../modules/guildHelpers.ts";
import { type getGuildConfig, getGuildConfigs } from "../modules/guilds.ts";
import logger from "../modules/logger.ts";

const router = Router();

router.get("/guild-select", async (req: Request, res: Response) => {
    if (!req.session.user || !req.session.accessToken) {
        req.session.returnTo = "/guild-select";
        return res.redirect("/login");
    }

    const user = req.session.user;
    const accessToken = req.session.accessToken;

    try {
        const guilds = await getCachedUserGuilds(req, accessToken);
        const guildIds = guilds.map((g) => g.id);
        const configs = await getGuildConfigs(guildIds);

        const guildMap = new Map(guilds.map((g) => [g.id, g]));
        const configMap = new Map(configs.map((c) => [c.guildId, c]));

        type AccessibleGuild = { guild: auth.DiscordGuild; config: Awaited<ReturnType<typeof getGuildConfig>> };
        const managedWithoutConfig = guilds.filter((g) => BigInt(g.permissions) & 32n && !configMap.has(g.id));
        const [accessibleConfiguredGuilds, botChecks] = await Promise.all([
            Promise.all(
                configs.map(async (config): Promise<AccessibleGuild | null> => {
                    const guild = guildMap.get(config.guildId);
                    if (!guild) return null;

                    const adminRoles = config.settings?.adminRole ?? [];
                    const allowed = await canAccessGuild(accessToken, config.guildId, guild.permissions, adminRoles);
                    return allowed ? { guild, config } : null;
                }),
            ),
            Promise.all(managedWithoutConfig.map((g) => botApi.isBotInGuild(g.id).then((inGuild) => ({ guild: g, inGuild })))),
        ]);

        const accessibleGuilds = accessibleConfiguredGuilds.filter((guild): guild is AccessibleGuild => guild !== null);
        for (const { guild, inGuild } of botChecks) {
            if (inGuild) {
                accessibleGuilds.push({ guild, config: null });
            }
        }

        res.render("pages/guild-select", {
            title: "Server Config — SWGoHBot",
            description: "Select a server to view its SWGoHBot configuration.",
            user,
            accessibleGuilds,
        });
    } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("401")) {
            req.session.returnTo = "/guild-select";
            return res.redirect("/login");
        }
        logger.error(`Guild select error: ${err}`);
        res.status(500).render("pages/500", {
            title: "Server Error — SWGoHBot",
            description: "Something went wrong loading your servers.",
        });
    }
});

export default router;
