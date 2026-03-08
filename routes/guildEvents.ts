import type { Request, Response } from "express";
import { Router } from "express";
import * as botApi from "../modules/botApi.ts";
import { formatValidationError } from "../modules/botSchemas.ts";
import { generateCsrfToken, rotateCsrfToken, verifyCsrfToken } from "../modules/csrf.ts";
import { GuildEventFormSchema } from "../modules/formSchemas.ts";
import { buildEventFromForm, canAccessGuild, getCachedUserGuilds } from "../modules/guildHelpers.ts";
import { getGuildConfig, updateGuildEvents } from "../modules/guilds.ts";

const router = Router();

// GET /guild/:id/event/new
router.get("/guild/:id/event/new", async (req: Request, res: Response) => {
    if (!req.session.user || !req.session.accessToken) {
        req.session.returnTo = `/guild/${req.params.id}/event/new`;
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

        if (!config) return res.redirect(`/guild/${guildId}`);

        const channels = await botApi.fetchGuildChannels(guildId);
        const csrfToken = generateCsrfToken(req);

        res.render("pages/guild-event-edit", {
            title: `Add Event — ${guild.name} — SWGoHBot`,
            description: `Add an event to ${guild.name}.`,
            user: req.session.user,
            guild,
            config,
            channels,
            csrfToken,
            event: null,
            isNew: true,
        });
    } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("401")) {
            req.session.returnTo = `/guild/${guildId}/event/new`;
            return res.redirect("/login");
        }
        console.error("Guild event new GET error:", err);
        res.status(500).render("pages/500", {
            title: "Server Error — SWGoHBot",
            description: "Something went wrong.",
        });
    }
});

// POST /guild/:id/event/new
router.post("/guild/:id/event/new", async (req: Request, res: Response) => {
    if (!req.session.user || !req.session.accessToken) return res.redirect("/login");

    const accessToken = req.session.accessToken;
    const guildId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!verifyCsrfToken(req)) {
        req.session.flash = { type: "error", message: "Invalid request. Please try again." };
        return res.redirect(`/guild/${guildId}/event/new`);
    }

    try {
        const [config, guilds] = await Promise.all([getGuildConfig(guildId), getCachedUserGuilds(req, accessToken)]);

        const guild = guilds.find((g) => g.id === guildId);
        if (!guild) return res.status(403).render("pages/500", { title: "Access Denied — SWGoHBot", description: "" });

        const adminRoles = config?.settings?.adminRole ?? [];
        const allowed = await canAccessGuild(accessToken, guildId, guild.permissions, adminRoles);
        if (!allowed) return res.status(403).render("pages/500", { title: "Access Denied — SWGoHBot", description: "" });
        if (!config) return res.redirect(`/guild/${guildId}`);

        const parsed = GuildEventFormSchema.safeParse({
            name: req.body.name,
            eventDT: req.body.eventDT || undefined,
            channel: req.body.channel || undefined,
            countdown: req.body.countdown,
            message: req.body.message || undefined,
            repeatDay: req.body.repeatDay || undefined,
            repeatHour: req.body.repeatHour || undefined,
            repeatMin: req.body.repeatMin || undefined,
            repeatDays: req.body.repeatDays || undefined,
        });

        if (!parsed.success) {
            req.session.flash = { type: "error", message: formatValidationError(parsed.error) };
            return res.redirect(`/guild/${guildId}/event/new`);
        }

        if (!config.settings?.announceChan && !parsed.data.channel) {
            req.session.flash = {
                type: "error",
                message: "A channel is required for this event because no server-wide announcement channel is set.",
            };
            return res.redirect(`/guild/${guildId}/event/new`);
        }

        if (!parsed.data.eventDT) {
            req.session.flash = { type: "error", message: "A date and time is required to create an event." };
            return res.redirect(`/guild/${guildId}/event/new`);
        }

        const events = config.events ?? [];
        if (events.length >= 50) {
            req.session.flash = { type: "error", message: "This server has reached the maximum of 50 events." };
            return res.redirect(`/guild/${guildId}/event/new`);
        }
        if (events.some((e) => e.name === parsed.data.name)) {
            req.session.flash = { type: "error", message: `An event named "${parsed.data.name}" already exists.` };
            return res.redirect(`/guild/${guildId}/event/new`);
        }

        const newEvent = buildEventFromForm(parsed.data);
        await updateGuildEvents(guildId, [...events, newEvent]);

        rotateCsrfToken(req);
        req.session.flash = { type: "success", message: `Event "${newEvent.name}" added.` };
        res.redirect(`/guild/${guildId}`);
    } catch (err) {
        console.error("Guild event new POST error:", err);
        req.session.flash = { type: "error", message: "Failed to save event. Please try again." };
        res.redirect(`/guild/${guildId}/event/new`);
    }
});

// GET /guild/:id/event/:name/edit
router.get("/guild/:id/event/:name/edit", async (req: Request, res: Response) => {
    const guildId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const nameParam = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
    const eventName = decodeURIComponent(nameParam);

    if (!req.session.user || !req.session.accessToken) {
        req.session.returnTo = `/guild/${guildId}/event/${nameParam}/edit`;
        return res.redirect("/login");
    }

    const accessToken = req.session.accessToken;

    try {
        const [config, guilds] = await Promise.all([getGuildConfig(guildId), getCachedUserGuilds(req, accessToken)]);

        const guild = guilds.find((g) => g.id === guildId);
        if (!guild) return res.status(403).render("pages/500", { title: "Access Denied — SWGoHBot", description: "" });

        const adminRoles = config?.settings?.adminRole ?? [];
        const allowed = await canAccessGuild(accessToken, guildId, guild.permissions, adminRoles);
        if (!allowed) return res.status(403).render("pages/500", { title: "Access Denied — SWGoHBot", description: "" });
        if (!config) return res.redirect(`/guild/${guildId}`);

        const event = config.events?.find((e) => e.name === eventName);
        if (!event) return res.status(404).render("pages/404", { title: "Not Found — SWGoHBot", description: "" });

        const channels = await botApi.fetchGuildChannels(guildId);
        const csrfToken = generateCsrfToken(req);

        res.render("pages/guild-event-edit", {
            title: `Edit Event — ${guild.name} — SWGoHBot`,
            description: `Edit event "${eventName}" in ${guild.name}.`,
            user: req.session.user,
            guild,
            config,
            channels,
            csrfToken,
            event,
            isNew: false,
        });
    } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("401")) {
            req.session.returnTo = `/guild/${guildId}/event/${req.params.name}/edit`;
            return res.redirect("/login");
        }
        console.error("Guild event edit GET error:", err);
        res.status(500).render("pages/500", { title: "Server Error — SWGoHBot", description: "" });
    }
});

// POST /guild/:id/event/:name/edit
router.post("/guild/:id/event/:name/edit", async (req: Request, res: Response) => {
    if (!req.session.user || !req.session.accessToken) return res.redirect("/login");

    const accessToken = req.session.accessToken;
    const guildId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const originalName = decodeURIComponent((Array.isArray(req.params.name) ? req.params.name[0] : req.params.name) as string);

    if (!verifyCsrfToken(req)) {
        req.session.flash = { type: "error", message: "Invalid request. Please try again." };
        return res.redirect(`/guild/${guildId}/event/${encodeURIComponent(originalName)}/edit`);
    }

    try {
        const [config, guilds] = await Promise.all([getGuildConfig(guildId), getCachedUserGuilds(req, accessToken)]);

        const guild = guilds.find((g) => g.id === guildId);
        if (!guild) return res.status(403).render("pages/500", { title: "Access Denied — SWGoHBot", description: "" });

        const adminRoles = config?.settings?.adminRole ?? [];
        const allowed = await canAccessGuild(accessToken, guildId, guild.permissions, adminRoles);
        if (!allowed) return res.status(403).render("pages/500", { title: "Access Denied — SWGoHBot", description: "" });
        if (!config) return res.redirect(`/guild/${guildId}`);

        const events = config.events ?? [];
        const idx = events.findIndex((e) => e.name === originalName);
        if (idx === -1) return res.status(404).render("pages/404", { title: "Not Found — SWGoHBot", description: "" });

        const parsed = GuildEventFormSchema.safeParse({
            name: req.body.name,
            eventDT: req.body.eventDT || undefined,
            channel: req.body.channel || undefined,
            countdown: req.body.countdown,
            message: req.body.message || undefined,
            repeatDay: req.body.repeatDay || undefined,
            repeatHour: req.body.repeatHour || undefined,
            repeatMin: req.body.repeatMin || undefined,
            repeatDays: req.body.repeatDays || undefined,
        });

        if (!parsed.success) {
            req.session.flash = { type: "error", message: formatValidationError(parsed.error) };
            return res.redirect(`/guild/${guildId}/event/${encodeURIComponent(originalName)}/edit`);
        }

        if (!config.settings?.announceChan && !parsed.data.channel) {
            req.session.flash = {
                type: "error",
                message: "A channel is required for this event because no server-wide announcement channel is set.",
            };
            return res.redirect(`/guild/${guildId}/event/${encodeURIComponent(originalName)}/edit`);
        }

        if (parsed.data.name !== originalName && events.some((e, i) => e.name === parsed.data.name && i !== idx)) {
            req.session.flash = { type: "error", message: `An event named "${parsed.data.name}" already exists.` };
            return res.redirect(`/guild/${guildId}/event/${encodeURIComponent(originalName)}/edit`);
        }

        const updatedEvent = buildEventFromForm(parsed.data);
        const updatedEvents = [...events];
        updatedEvents[idx] = updatedEvent;
        await updateGuildEvents(guildId, updatedEvents);

        rotateCsrfToken(req);
        req.session.flash = { type: "success", message: `Event "${updatedEvent.name}" saved.` };
        res.redirect(`/guild/${guildId}`);
    } catch (err) {
        console.error("Guild event edit POST error:", err);
        req.session.flash = { type: "error", message: "Failed to save event. Please try again." };
        res.redirect(`/guild/${guildId}/event/${encodeURIComponent(originalName)}/edit`);
    }
});

// POST /guild/:id/event/:name/delete
router.post("/guild/:id/event/:name/delete", async (req: Request, res: Response) => {
    if (!req.session.user || !req.session.accessToken) return res.redirect("/login");

    const accessToken = req.session.accessToken;
    const guildId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const eventName = decodeURIComponent((Array.isArray(req.params.name) ? req.params.name[0] : req.params.name) as string);

    if (!verifyCsrfToken(req)) {
        req.session.flash = { type: "error", message: "Invalid request. Please try again." };
        return res.redirect(`/guild/${guildId}`);
    }

    try {
        const [config, guilds] = await Promise.all([getGuildConfig(guildId), getCachedUserGuilds(req, accessToken)]);

        const guild = guilds.find((g) => g.id === guildId);
        if (!guild) return res.status(403).render("pages/500", { title: "Access Denied — SWGoHBot", description: "" });

        const adminRoles = config?.settings?.adminRole ?? [];
        const allowed = await canAccessGuild(accessToken, guildId, guild.permissions, adminRoles);
        if (!allowed) return res.status(403).render("pages/500", { title: "Access Denied — SWGoHBot", description: "" });
        if (!config) return res.redirect(`/guild/${guildId}`);

        const events = config.events ?? [];
        const idx = events.findIndex((e) => e.name === eventName);
        if (idx === -1) return res.status(404).render("pages/404", { title: "Not Found — SWGoHBot", description: "" });

        await updateGuildEvents(
            guildId,
            events.filter((_, i) => i !== idx),
        );

        rotateCsrfToken(req);
        req.session.flash = { type: "success", message: `Event "${eventName}" deleted.` };
        res.redirect(`/guild/${guildId}`);
    } catch (err) {
        console.error("Guild event delete POST error:", err);
        req.session.flash = { type: "error", message: "Failed to delete event. Please try again." };
        res.redirect(`/guild/${guildId}`);
    }
});

export default router;
