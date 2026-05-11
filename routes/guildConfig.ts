import type { Request, Response } from "express";
import { Router } from "express";
import type { DiscordGuild } from "../modules/auth.ts";
import * as botApi from "../modules/botApi.ts";
import { formatValidationError } from "../modules/botSchemas.ts";
import { generateCsrfToken, rotateCsrfToken, verifyCsrfToken } from "../modules/csrf.ts";
import { GuildSettingsFormSchema } from "../modules/formSchemas.ts";
import { canAccessGuild, getCachedUserGuilds } from "../modules/guildHelpers.ts";
import { diffFromDefaults, getGuildConfig, updateGuildSettings } from "../modules/guilds.ts";
import logger from "../modules/logger.ts";
import { saveLimiter } from "../middleware/rateLimit.ts";
import { getUnitNames } from "../modules/units.ts";

type GuildConfig = Awaited<ReturnType<typeof getGuildConfig>>;

function bodyToSettings(body: Record<string, unknown>) {
    const adminRoleRaw = body.adminRole;
    return {
        language: body.language,
        swgohLanguage: body.swgohLanguage,
        timezone: body.timezone,
        announceChan: body.announceChan || undefined,
        adminRole: Array.isArray(adminRoleRaw) ? adminRoleRaw : adminRoleRaw ? [adminRoleRaw] : [],
        useEventPages: body.useEventPages === "on",
        shardtimeVertical: body.shardtimeVertical === "on",
        eventCountdown: typeof body.eventCountdown === "string" ? body.eventCountdown : undefined,
        enableWelcome: body.enableWelcome === "on",
        welcomeMessage: body.welcomeMessage,
        enablePart: body.enablePart === "on",
        partMessage: body.partMessage,
    };
}

async function renderEditForm(
    req: Request,
    res: Response,
    guildId: string,
    guild: DiscordGuild,
    config: GuildConfig,
    flash: { type: "success" | "error"; message: string },
    formValues?: ReturnType<typeof bodyToSettings>,
) {
    try {
        const [roles, channels] = await Promise.all([botApi.fetchGuildRoles(guildId), botApi.fetchGuildChannels(guildId)]);
        const csrfToken = generateCsrfToken(req);
        const timezones = Intl.supportedValuesOf("timeZone");
        res.locals.flash = flash;
        res.render("pages/guild-config-edit", {
            title: `Edit ${guild.name} Config — SWGoHBot`,
            description: `Edit SWGoHBot configuration for ${guild.name}.`,
            user: req.session.user,
            guild,
            config,
            roles,
            channels,
            csrfToken,
            timezones,
            formValues,
        });
    } catch {
        req.session.flash = flash;
        res.redirect(`/guild/${guildId}`);
    }
}

const router = Router();

// GET /guild/:id
router.get("/guild/:id", async (req: Request, res: Response) => {
    if (!req.session.user || !req.session.accessToken) {
        req.session.returnTo = `/guild/${req.params.id}`;
        return res.redirect("/login");
    }

    const user = req.session.user;
    const accessToken = req.session.accessToken;
    const guildId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
        const [config, guilds] = await Promise.all([getGuildConfig(guildId), getCachedUserGuilds(req, accessToken)]);

        const guild = guilds.find((g) => g.id === guildId);
        if (!guild) {
            return res.status(403).render("pages/500", {
                title: "Access Denied — SWGoHBot",
                description: "You do not have access to this server's configuration.",
            });
        }

        const adminRoles = config?.settings?.adminRole ?? [];
        const allowed = await canAccessGuild(accessToken, guildId, guild.permissions, adminRoles);
        if (!allowed) {
            return res.status(403).render("pages/500", {
                title: "Access Denied — SWGoHBot",
                description: "You do not have access to this server's configuration.",
            });
        }

        if (!config) {
            return res.render("pages/guild-config", {
                title: `${guild.name} Config — SWGoHBot`,
                description: `SWGoHBot configuration for ${guild.name}.`,
                user,
                guild,
                config: null,
                roleMap: {},
                channelMap: {},
                unitNameMap: {},
            });
        }

        const twDefIds = [
            ...(config.settings?.twList?.light ?? []),
            ...(config.settings?.twList?.dark ?? []),
            ...Object.values(config.settings?.aliases ?? {}),
        ];

        const [roles, channels, unitNameMap] = await Promise.all([
            botApi.fetchGuildRoles(guildId),
            botApi.fetchGuildChannels(guildId),
            getUnitNames(twDefIds),
        ]);

        const roleMap: Record<string, string> = Object.fromEntries(roles.map((r) => [r.id, r.name]));
        const channelMap: Record<string, string> = Object.fromEntries(channels.map((c) => [c.id, c.name]));
        const csrfToken = generateCsrfToken(req);

        res.render("pages/guild-config", {
            title: `${guild.name} Config — SWGoHBot`,
            description: `SWGoHBot configuration for ${guild.name}.`,
            user,
            guild,
            config,
            roleMap,
            channelMap,
            unitNameMap,
            canManage: allowed,
            csrfToken,
        });
    } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("401")) {
            req.session.returnTo = `/guild/${guildId}`;
            return res.redirect("/login");
        }
        logger.error(`Guild config error: ${err}`);
        res.status(500).render("pages/500", {
            title: "Server Error — SWGoHBot",
            description: "Something went wrong loading this server's configuration.",
        });
    }
});

// GET /guild/:id/edit
router.get("/guild/:id/edit", async (req: Request, res: Response) => {
    if (!req.session.user || !req.session.accessToken) {
        req.session.returnTo = `/guild/${req.params.id}/edit`;
        return res.redirect("/login");
    }

    const accessToken = req.session.accessToken;
    const guildId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
        const [config, guilds] = await Promise.all([getGuildConfig(guildId), getCachedUserGuilds(req, accessToken)]);

        const guild = guilds.find((g) => g.id === guildId);
        if (!guild) {
            return res.status(403).render("pages/500", {
                title: "Access Denied — SWGoHBot",
                description: "You do not have access to this server's configuration.",
            });
        }

        const adminRoles = config?.settings?.adminRole ?? [];
        const allowed = await canAccessGuild(accessToken, guildId, guild.permissions, adminRoles);
        if (!allowed) {
            return res.status(403).render("pages/500", {
                title: "Access Denied — SWGoHBot",
                description: "You do not have access to this server's configuration.",
            });
        }

        if (!config) {
            return res.redirect(`/guild/${guildId}`);
        }

        const [roles, channels] = await Promise.all([botApi.fetchGuildRoles(guildId), botApi.fetchGuildChannels(guildId)]);
        const csrfToken = generateCsrfToken(req);
        const timezones = Intl.supportedValuesOf("timeZone");

        res.render("pages/guild-config-edit", {
            title: `Edit ${guild.name} Config — SWGoHBot`,
            description: `Edit SWGoHBot configuration for ${guild.name}.`,
            user: req.session.user,
            guild,
            config,
            roles,
            channels,
            csrfToken,
            timezones,
        });
    } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("401")) {
            req.session.returnTo = `/guild/${guildId}/edit`;
            return res.redirect("/login");
        }
        logger.error(`Guild config edit GET error: ${err}`);
        req.session.flash = { type: "error", message: "Could not load server data from Discord. Please try again shortly." };
        res.redirect(`/guild/${guildId}`);
    }
});

// POST /guild/:id/edit
router.post("/guild/:id/edit", saveLimiter, async (req: Request, res: Response) => {
    if (!req.session.user || !req.session.accessToken) {
        return res.redirect("/login");
    }

    const accessToken = req.session.accessToken;
    const guildId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!verifyCsrfToken(req)) {
        req.session.flash = { type: "error", message: "Invalid request. Please try again." };
        return res.redirect(`/guild/${guildId}/edit`);
    }

    let guild: DiscordGuild | undefined;
    let config: GuildConfig | undefined;

    try {
        const [fetchedConfig, guilds] = await Promise.all([getGuildConfig(guildId), getCachedUserGuilds(req, accessToken)]);
        config = fetchedConfig;
        guild = guilds.find((g) => g.id === guildId);

        if (!guild) {
            return res.status(403).render("pages/500", {
                title: "Access Denied — SWGoHBot",
                description: "You do not have access to this server's configuration.",
            });
        }

        const adminRoles = config?.settings?.adminRole ?? [];
        const allowed = await canAccessGuild(accessToken, guildId, guild.permissions, adminRoles);
        if (!allowed) {
            return res.status(403).render("pages/500", {
                title: "Access Denied — SWGoHBot",
                description: "You do not have access to this server's configuration.",
            });
        }

        if (!config) {
            return res.redirect(`/guild/${guildId}`);
        }

        const adminRoleRaw = req.body.adminRole;
        const adminRoleArr = Array.isArray(adminRoleRaw) ? adminRoleRaw : adminRoleRaw ? [adminRoleRaw] : [];

        const parsed = GuildSettingsFormSchema.safeParse({
            language: req.body.language || undefined,
            swgohLanguage: req.body.swgohLanguage || undefined,
            timezone: req.body.timezone || undefined,
            useEventPages: req.body.useEventPages === "on",
            shardtimeVertical: req.body.shardtimeVertical === "on",
            announceChan: req.body.announceChan ?? undefined,
            adminRole: adminRoleArr,
            eventCountdown: req.body.eventCountdown ?? "",
            enableWelcome: req.body.enableWelcome === "on",
            welcomeMessage: req.body.welcomeMessage ?? undefined,
            enablePart: req.body.enablePart === "on",
            partMessage: req.body.partMessage ?? undefined,
        });

        if (!parsed.success) {
            return renderEditForm(
                req,
                res,
                guildId,
                guild,
                config,
                { type: "error", message: formatValidationError(parsed.error) },
                bodyToSettings(req.body as Record<string, unknown>),
            );
        }

        const { set, unset } = diffFromDefaults(parsed.data);
        await updateGuildSettings(guildId, set, unset.length ? unset : undefined);

        rotateCsrfToken(req);
        req.session.flash = { type: "success", message: "Server settings saved." };
        res.redirect(`/guild/${guildId}`);
    } catch (err) {
        logger.error(`Guild config edit POST error: ${err}`);
        if (guild && config) {
            return renderEditForm(
                req,
                res,
                guildId,
                guild,
                config,
                { type: "error", message: "Failed to save settings. Please try again." },
                bodyToSettings(req.body as Record<string, unknown>),
            );
        }
        req.session.flash = { type: "error", message: "Failed to save settings. Please try again." };
        res.redirect(`/guild/${guildId}/edit`);
    }
});

export default router;
