import type { Request, Response } from "express";
import { Router } from "express";
import * as botApi from "../modules/botApi.ts";
import { formatValidationError } from "../modules/botSchemas.ts";
import { generateCsrfToken, rotateCsrfToken, verifyCsrfToken } from "../modules/csrf.ts";
import { GuildSettingsFormSchema, VALID_TIMEZONES } from "../modules/formSchemas.ts";
import { diffFromDefaults, type GuildConfig, updateGuildSettings } from "../modules/guilds.ts";
import logger from "../modules/logger.ts";
import { requireGuildAccess, type GuildLocals } from "../middleware/requireGuildAccess.ts";
import { saveLimiter } from "../middleware/rateLimit.ts";
import { getUnitNames } from "../modules/units.ts";

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
    guild: GuildLocals["guild"],
    config: GuildConfig | null,
    flash: { type: "success" | "error"; message: string },
    formValues?: ReturnType<typeof bodyToSettings>,
) {
    try {
        const [roles, channels] = await Promise.all([botApi.fetchGuildRoles(guildId), botApi.fetchGuildChannels(guildId)]);
        const csrfToken = generateCsrfToken(req);
        const timezones = VALID_TIMEZONES;
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
router.get("/guild/:id", requireGuildAccess, async (req: Request, res: Response) => {
    const user = req.session.user;
    if (!user) return;
    const { guildId, guild, config } = res.locals as GuildLocals;

    if (!config) {
        res.render("pages/guild-config", {
            title: `${guild.name} Config — SWGoHBot`,
            description: `SWGoHBot configuration for ${guild.name}.`,
            user,
            guild,
            config: null,
            roleMap: {},
            channelMap: {},
            unitNameMap: {},
        });
        return;
    }

    try {
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
            canManage: true,
            csrfToken,
        });
    } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("401")) {
            req.session.returnTo = `/guild/${guildId}`;
            res.redirect("/login");
            return;
        }
        logger.error(`Guild config error: ${err}`);
        res.status(500).render("pages/500", {
            title: "Server Error — SWGoHBot",
            description: "Something went wrong loading this server's configuration.",
        });
    }
});

// GET /guild/:id/edit
router.get("/guild/:id/edit", requireGuildAccess, async (req: Request, res: Response) => {
    const { guildId, guild, config } = res.locals as GuildLocals;

    if (!config) {
        res.redirect(`/guild/${guildId}`);
        return;
    }

    try {
        const [roles, channels] = await Promise.all([botApi.fetchGuildRoles(guildId), botApi.fetchGuildChannels(guildId)]);
        const csrfToken = generateCsrfToken(req);
        const timezones = VALID_TIMEZONES;

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
            res.redirect("/login");
            return;
        }
        logger.error(`Guild config edit GET error: ${err}`);
        req.session.flash = { type: "error", message: "Could not load server data from Discord. Please try again shortly." };
        res.redirect(`/guild/${guildId}`);
    }
});

// POST /guild/:id/edit
router.post("/guild/:id/edit", saveLimiter, requireGuildAccess, async (req: Request, res: Response) => {
    const { guildId, guild, config } = res.locals as GuildLocals;

    if (!config) {
        res.redirect(`/guild/${guildId}`);
        return;
    }

    if (!verifyCsrfToken(req)) {
        req.session.flash = { type: "error", message: "Invalid request. Please try again." };
        res.redirect(`/guild/${guildId}/edit`);
        return;
    }

    const adminRoleRaw = req.body.adminRole;
    const adminRoleArr = Array.isArray(adminRoleRaw) ? adminRoleRaw : adminRoleRaw ? [adminRoleRaw] : [];

    const parsed = GuildSettingsFormSchema.safeParse({
        language: req.body.language || undefined,
        swgohLanguage: req.body.swgohLanguage || undefined,
        timezone: req.body.timezone || undefined,
        useEventPages: req.body.useEventPages === "on",
        shardtimeVertical: req.body.shardtimeVertical === "on",
        announceChan: req.body.announceChan || undefined,
        adminRole: adminRoleArr,
        eventCountdown: req.body.eventCountdown ?? "",
        enableWelcome: req.body.enableWelcome === "on",
        welcomeMessage: req.body.welcomeMessage ?? undefined,
        enablePart: req.body.enablePart === "on",
        partMessage: req.body.partMessage ?? undefined,
    });

    if (!parsed.success) {
        renderEditForm(
            req,
            res,
            guildId,
            guild,
            config,
            { type: "error", message: formatValidationError(parsed.error) },
            bodyToSettings(req.body as Record<string, unknown>),
        );
        return;
    }

    try {
        const { set, unset } = diffFromDefaults(parsed.data);
        await updateGuildSettings(guildId, set, unset.length ? unset : undefined);

        rotateCsrfToken(req);
        req.session.flash = { type: "success", message: "Server settings saved." };
        res.redirect(`/guild/${guildId}`);
    } catch (err) {
        logger.error(`Guild config edit POST error: ${err}`);
        renderEditForm(
            req,
            res,
            guildId,
            guild,
            config,
            { type: "error", message: "Failed to save settings. Please try again." },
            bodyToSettings(req.body as Record<string, unknown>),
        );
    }
});

export default router;
