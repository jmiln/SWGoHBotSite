import type { Request, Response } from "express";
import { Router } from "express";
import * as botApi from "../modules/botApi.ts";
import { formatValidationError } from "../modules/botSchemas.ts";
import { generateCsrfToken, rotateCsrfToken, verifyCsrfToken } from "../modules/csrf.ts";
import { GuildEventFormSchema } from "../modules/formSchemas.ts";
import { buildEventFromForm } from "../modules/guildHelpers.ts";
import { updateGuildEvents } from "../modules/guilds.ts";
import logger from "../modules/logger.ts";
import { requireGuildAccess, type GuildLocals } from "../middleware/requireGuildAccess.ts";

const router = Router();

// GET /guild/:id/event/new
router.get("/guild/:id/event/new", requireGuildAccess, async (req: Request, res: Response) => {
    const { guildId, guild, config } = res.locals as GuildLocals;

    if (!config) {
        res.redirect(`/guild/${guildId}`);
        return;
    }

    try {
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
            req.session.returnTo = req.originalUrl;
            res.redirect("/login");
            return;
        }
        logger.error(`Guild event new GET error: ${err}`);
        res.status(500).render("pages/500", {
            title: "Server Error — SWGoHBot",
            description: "Something went wrong.",
        });
    }
});

// POST /guild/:id/event/new
router.post("/guild/:id/event/new", requireGuildAccess, async (req: Request, res: Response) => {
    const { guildId, config } = res.locals as GuildLocals;

    if (!config) {
        res.redirect(`/guild/${guildId}`);
        return;
    }

    if (!verifyCsrfToken(req)) {
        req.session.flash = { type: "error", message: "Invalid request. Please try again." };
        res.redirect(`/guild/${guildId}/event/new`);
        return;
    }

    try {
        const parsed = GuildEventFormSchema.safeParse({
            name: req.body.name,
            eventDT: req.body.eventDT || undefined,
            eventDTUtc: req.body.eventDTUtc || undefined,
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
            res.redirect(`/guild/${guildId}/event/new`);
            return;
        }

        if (!config.settings?.announceChan && !parsed.data.channel) {
            req.session.flash = {
                type: "error",
                message: "A channel is required for this event because no server-wide announcement channel is set.",
            };
            res.redirect(`/guild/${guildId}/event/new`);
            return;
        }

        if (!parsed.data.eventDT && !parsed.data.eventDTUtc) {
            req.session.flash = { type: "error", message: "A date and time is required to create an event." };
            res.redirect(`/guild/${guildId}/event/new`);
            return;
        }

        const events = config.events ?? [];
        if (events.length >= 50) {
            req.session.flash = { type: "error", message: "This server has reached the maximum of 50 events." };
            res.redirect(`/guild/${guildId}/event/new`);
            return;
        }
        if (events.some((e) => e.name === parsed.data.name)) {
            req.session.flash = { type: "error", message: `An event named "${parsed.data.name}" already exists.` };
            res.redirect(`/guild/${guildId}/event/new`);
            return;
        }

        const newEvent = buildEventFromForm(parsed.data);
        await updateGuildEvents(guildId, [...events, newEvent]);

        rotateCsrfToken(req);
        req.session.flash = { type: "success", message: `Event "${newEvent.name}" added.` };
        res.redirect(`/guild/${guildId}`);
    } catch (err) {
        logger.error(`Guild event new POST error: ${err}`);
        req.session.flash = { type: "error", message: "Failed to save event. Please try again." };
        res.redirect(`/guild/${guildId}/event/new`);
    }
});

// GET /guild/:id/event/:name/edit
router.get("/guild/:id/event/:name/edit", requireGuildAccess, async (req: Request, res: Response) => {
    const { guildId, guild, config } = res.locals as GuildLocals;
    const nameParam = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
    const eventName = decodeURIComponent(nameParam);

    if (!config) {
        res.redirect(`/guild/${guildId}`);
        return;
    }

    try {
        const event = config.events?.find((e) => e.name === eventName);
        if (!event) {
            res.status(404).render("pages/404");
            return;
        }

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
            req.session.returnTo = req.originalUrl;
            res.redirect("/login");
            return;
        }
        logger.error(`Guild event edit GET error: ${err}`);
        res.status(500).render("pages/500", { title: "Server Error — SWGoHBot", description: "" });
    }
});

// POST /guild/:id/event/:name/edit
router.post("/guild/:id/event/:name/edit", requireGuildAccess, async (req: Request, res: Response) => {
    const { guildId, config } = res.locals as GuildLocals;
    const originalName = decodeURIComponent((Array.isArray(req.params.name) ? req.params.name[0] : req.params.name) as string);

    if (!config) {
        res.redirect(`/guild/${guildId}`);
        return;
    }

    if (!verifyCsrfToken(req)) {
        req.session.flash = { type: "error", message: "Invalid request. Please try again." };
        res.redirect(`/guild/${guildId}/event/${encodeURIComponent(originalName)}/edit`);
        return;
    }

    try {
        const events = config.events ?? [];
        const idx = events.findIndex((e) => e.name === originalName);
        if (idx === -1) {
            res.status(404).render("pages/404");
            return;
        }

        const parsed = GuildEventFormSchema.safeParse({
            name: req.body.name,
            eventDT: req.body.eventDT || undefined,
            eventDTUtc: req.body.eventDTUtc || undefined,
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
            res.redirect(`/guild/${guildId}/event/${encodeURIComponent(originalName)}/edit`);
            return;
        }

        if (!parsed.data.eventDT && !parsed.data.eventDTUtc) {
            req.session.flash = { type: "error", message: "A date and time is required to save an event." };
            res.redirect(`/guild/${guildId}/event/${encodeURIComponent(originalName)}/edit`);
            return;
        }

        if (!config.settings?.announceChan && !parsed.data.channel) {
            req.session.flash = {
                type: "error",
                message: "A channel is required for this event because no server-wide announcement channel is set.",
            };
            res.redirect(`/guild/${guildId}/event/${encodeURIComponent(originalName)}/edit`);
            return;
        }

        if (parsed.data.name !== originalName && events.some((e, i) => e.name === parsed.data.name && i !== idx)) {
            req.session.flash = { type: "error", message: `An event named "${parsed.data.name}" already exists.` };
            res.redirect(`/guild/${guildId}/event/${encodeURIComponent(originalName)}/edit`);
            return;
        }

        const updatedEvent = buildEventFromForm(parsed.data);
        const updatedEvents = [...events];
        updatedEvents[idx] = updatedEvent;
        await updateGuildEvents(guildId, updatedEvents);

        rotateCsrfToken(req);
        req.session.flash = { type: "success", message: `Event "${updatedEvent.name}" saved.` };
        res.redirect(`/guild/${guildId}`);
    } catch (err) {
        logger.error(`Guild event edit POST error: ${err}`);
        req.session.flash = { type: "error", message: "Failed to save event. Please try again." };
        res.redirect(`/guild/${guildId}/event/${encodeURIComponent(originalName)}/edit`);
    }
});

// POST /guild/:id/event/:name/delete
router.post("/guild/:id/event/:name/delete", requireGuildAccess, async (req: Request, res: Response) => {
    const { guildId, config } = res.locals as GuildLocals;
    const eventName = decodeURIComponent((Array.isArray(req.params.name) ? req.params.name[0] : req.params.name) as string);

    if (!config) {
        res.redirect(`/guild/${guildId}`);
        return;
    }

    if (!verifyCsrfToken(req)) {
        req.session.flash = { type: "error", message: "Invalid request. Please try again." };
        res.redirect(`/guild/${guildId}`);
        return;
    }

    try {
        const events = config.events ?? [];
        const idx = events.findIndex((e) => e.name === eventName);
        if (idx === -1) {
            res.status(404).render("pages/404");
            return;
        }

        await updateGuildEvents(
            guildId,
            events.filter((_, i) => i !== idx),
        );

        rotateCsrfToken(req);
        req.session.flash = { type: "success", message: `Event "${eventName}" deleted.` };
        res.redirect(`/guild/${guildId}`);
    } catch (err) {
        logger.error(`Guild event delete POST error: ${err}`);
        req.session.flash = { type: "error", message: "Failed to delete event. Please try again." };
        res.redirect(`/guild/${guildId}`);
    }
});

export default router;
