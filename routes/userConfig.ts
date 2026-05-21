import type { Request, Response } from "express";
import { Router } from "express";
import { formatValidationError } from "../modules/botSchemas.ts";
import { generateCsrfToken, rotateCsrfToken, verifyCsrfToken } from "../modules/csrf.ts";
import {
    ArenaAlertFormSchema,
    ArenaWatchFormSchema,
    GuildTicketsFormSchema,
    GuildUpdateFormSchema,
    LangFormSchema,
} from "../modules/formSchemas.ts";
import logger from "../modules/logger.ts";
import { type UserConfig, getUser, updateUser } from "../modules/users.ts";

const router = Router();

function isPatreon(userConfig: UserConfig | null | undefined): boolean {
    return (userConfig?.patreonAmountCents ?? 0) > 0;
}

async function renderPatreonGatedEdit(req: Request, res: Response, page: string, title: string, description: string): Promise<void> {
    const user = req.session.user;
    if (!user) return;
    const userConfig = await getUser(user.id);
    if (!isPatreon(userConfig)) {
        req.session.flash = { type: "error", message: "This feature requires an active Patreon subscription." };
        res.redirect("/config");
        return;
    }
    const csrfToken = generateCsrfToken(req);
    res.render(page, { title, description, user, userConfig, csrfToken });
}

// GET /config
router.get("/config", async (req: Request, res: Response) => {
    const user = req.session.user;
    if (!user) return;
    const userConfig = await getUser(user.id);
    if (userConfig?.accounts) {
        userConfig.accounts.sort((a: { name: string }, b: { name: string }) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    }
    if (userConfig?.arenaWatch?.allyCodes) {
        userConfig.arenaWatch.allyCodes.sort((a: { name: string }, b: { name: string }) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
        );
    }
    res.render("pages/config", {
        title: "My Config — SWGoHBot",
        description: "Your SWGoHBot configuration.",
        user,
        userConfig,
        isPatreon: isPatreon(userConfig),
    });
});

// GET /config/edit/lang
router.get("/config/edit/lang", async (req: Request, res: Response) => {
    const user = req.session.user;
    if (!user) return;
    const userConfig = await getUser(user.id);
    const csrfToken = generateCsrfToken(req);
    res.render("pages/config-edit-lang", {
        title: "Edit Language Settings — SWGoHBot",
        description: "Edit your SWGoHBot language settings.",
        user,
        userConfig,
        csrfToken,
    });
});

// POST /config/lang
router.post("/config/lang", async (req: Request, res: Response) => {
    if (!verifyCsrfToken(req)) {
        res.status(403).send("Forbidden");
        return;
    }
    const user = req.session.user;
    if (!user) return;
    try {
        const userConfig = await getUser(user.id);
        if (!userConfig) {
            req.session.flash = { type: "error", message: "Config not found." };
            res.redirect("/config");
            return;
        }
        const parsed = LangFormSchema.safeParse({
            language: req.body.language || undefined,
            swgohLanguage: req.body.swgohLanguage || undefined,
        });
        if (!parsed.success) {
            req.session.flash = { type: "error", message: formatValidationError(parsed.error) };
            res.redirect("/config/edit/lang");
            return;
        }
        await updateUser(user.id, { lang: parsed.data });
        rotateCsrfToken(req);
        req.session.flash = { type: "success", message: "Language settings saved." };
        res.redirect("/config");
    } catch (err) {
        logger.error(`Config update error (lang): ${err}`);
        req.session.flash = { type: "error", message: "Failed to save settings. Please try again." };
        res.redirect("/config");
    }
});

// GET /config/edit/arena-alert
router.get("/config/edit/arena-alert", (req: Request, res: Response) => {
    return renderPatreonGatedEdit(
        req,
        res,
        "pages/config-edit-arena-alert",
        "Edit Arena Alert Settings — SWGoHBot",
        "Edit your SWGoHBot arena alert settings.",
    );
});

// POST /config/arena-alert
router.post("/config/arena-alert", async (req: Request, res: Response) => {
    if (!verifyCsrfToken(req)) {
        res.status(403).send("Forbidden");
        return;
    }
    const user = req.session.user;
    if (!user) return;
    try {
        const userConfig = await getUser(user.id);
        if (!userConfig) {
            req.session.flash = { type: "error", message: "Config not found." };
            res.redirect("/config");
            return;
        }
        if (!isPatreon(userConfig)) {
            res.status(403).send("Forbidden");
            return;
        }
        const parsed = ArenaAlertFormSchema.safeParse({
            enableRankDMs: req.body.enableRankDMs || undefined,
            arena: req.body.arena || undefined,
            payoutWarning: req.body.payoutWarning || undefined,
            enablePayoutResult: req.body.enablePayoutResult === "on",
        });
        if (!parsed.success) {
            req.session.flash = { type: "error", message: formatValidationError(parsed.error) };
            res.redirect("/config/edit/arena-alert");
            return;
        }
        await updateUser(user.id, {
            arenaAlert: {
                enableRankDMs: parsed.data.enableRankDMs ?? userConfig.arenaAlert?.enableRankDMs ?? "off",
                arena: parsed.data.arena ?? userConfig.arenaAlert?.arena ?? "both",
                payoutWarning: parsed.data.payoutWarning ?? userConfig.arenaAlert?.payoutWarning ?? 0,
                enablePayoutResult: parsed.data.enablePayoutResult ?? false,
            },
        });
        rotateCsrfToken(req);
        req.session.flash = { type: "success", message: "Arena alert settings saved." };
        res.redirect("/config");
    } catch (err) {
        logger.error(`Config update error (arena-alert): ${err}`);
        req.session.flash = { type: "error", message: "Failed to save settings. Please try again." };
        res.redirect("/config");
    }
});

// GET /config/edit/arena-watch
router.get("/config/edit/arena-watch", (req: Request, res: Response) => {
    return renderPatreonGatedEdit(
        req,
        res,
        "pages/config-edit-arena-watch",
        "Edit Arena Watch Settings — SWGoHBot",
        "Edit your SWGoHBot arena watch settings.",
    );
});

// POST /config/arena-watch
router.post("/config/arena-watch", async (req: Request, res: Response) => {
    if (!verifyCsrfToken(req)) {
        res.status(403).send("Forbidden");
        return;
    }
    const user = req.session.user;
    if (!user) return;
    try {
        const userConfig = await getUser(user.id);
        if (!userConfig) {
            req.session.flash = { type: "error", message: "Config not found." };
            res.redirect("/config");
            return;
        }
        if (!isPatreon(userConfig)) {
            res.status(403).send("Forbidden");
            return;
        }
        const parsed = ArenaWatchFormSchema.safeParse({
            enabled: req.body.enabled === "on",
            report: req.body.report || undefined,
            showvs: req.body.showvs === "on",
        });
        if (!parsed.success) {
            req.session.flash = { type: "error", message: formatValidationError(parsed.error) };
            res.redirect("/config/edit/arena-watch");
            return;
        }
        await updateUser(user.id, {
            arenaWatch: {
                enabled: parsed.data.enabled,
                allyCodes: userConfig.arenaWatch?.allyCodes ?? [],
                report: parsed.data.report ?? userConfig.arenaWatch?.report ?? "both",
                showvs: parsed.data.showvs,
            },
        });
        rotateCsrfToken(req);
        req.session.flash = { type: "success", message: "Arena watch settings saved." };
        res.redirect("/config");
    } catch (err) {
        logger.error(`Config update error (arena-watch): ${err}`);
        req.session.flash = { type: "error", message: "Failed to save settings. Please try again." };
        res.redirect("/config");
    }
});

// GET /config/edit/guild-update
router.get("/config/edit/guild-update", (req: Request, res: Response) => {
    return renderPatreonGatedEdit(
        req,
        res,
        "pages/config-edit-guild-update",
        "Edit Guild Update Settings — SWGoHBot",
        "Edit your SWGoHBot guild update settings.",
    );
});

// POST /config/guild-update
router.post("/config/guild-update", async (req: Request, res: Response) => {
    if (!verifyCsrfToken(req)) {
        res.status(403).send("Forbidden");
        return;
    }
    const user = req.session.user;
    if (!user) return;
    try {
        const userConfig = await getUser(user.id);
        if (!userConfig) {
            req.session.flash = { type: "error", message: "Config not found." };
            res.redirect("/config");
            return;
        }
        if (!isPatreon(userConfig)) {
            res.status(403).send("Forbidden");
            return;
        }
        const parsed = GuildUpdateFormSchema.safeParse({
            enabled: req.body.enabled === "on",
        });
        if (!parsed.success) {
            req.session.flash = { type: "error", message: formatValidationError(parsed.error) };
            res.redirect("/config/edit/guild-update");
            return;
        }
        await updateUser(user.id, {
            guildUpdate: {
                ...userConfig.guildUpdate,
                enabled: parsed.data.enabled,
            },
        });
        rotateCsrfToken(req);
        req.session.flash = { type: "success", message: "Guild update settings saved." };
        res.redirect("/config");
    } catch (err) {
        logger.error(`Config update error (guild-update): ${err}`);
        req.session.flash = { type: "error", message: "Failed to save settings. Please try again." };
        res.redirect("/config");
    }
});

// GET /config/edit/guild-tickets
router.get("/config/edit/guild-tickets", (req: Request, res: Response) => {
    return renderPatreonGatedEdit(
        req,
        res,
        "pages/config-edit-guild-tickets",
        "Edit Guild Tickets Settings — SWGoHBot",
        "Edit your SWGoHBot guild tickets settings.",
    );
});

// POST /config/guild-tickets
router.post("/config/guild-tickets", async (req: Request, res: Response) => {
    if (!verifyCsrfToken(req)) {
        res.status(403).send("Forbidden");
        return;
    }
    const user = req.session.user;
    if (!user) return;
    try {
        const userConfig = await getUser(user.id);
        if (!userConfig) {
            req.session.flash = { type: "error", message: "Config not found." };
            res.redirect("/config");
            return;
        }
        if (!isPatreon(userConfig)) {
            res.status(403).send("Forbidden");
            return;
        }
        const parsed = GuildTicketsFormSchema.safeParse({
            enabled: req.body.enabled === "on",
            sortBy: req.body.sortBy || undefined,
            showMax: req.body.showMax === "on",
        });
        if (!parsed.success) {
            req.session.flash = { type: "error", message: formatValidationError(parsed.error) };
            res.redirect("/config/edit/guild-tickets");
            return;
        }
        await updateUser(user.id, {
            guildTickets: {
                enabled: parsed.data.enabled,
                sortBy: parsed.data.sortBy ?? userConfig.guildTickets?.sortBy ?? "tickets",
                showMax: parsed.data.showMax,
            },
        });
        rotateCsrfToken(req);
        req.session.flash = { type: "success", message: "Guild tickets settings saved." };
        res.redirect("/config");
    } catch (err) {
        logger.error(`Config update error (guild-tickets): ${err}`);
        req.session.flash = { type: "error", message: "Failed to save settings. Please try again." };
        res.redirect("/config");
    }
});

export default router;
