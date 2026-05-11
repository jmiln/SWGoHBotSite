import type { Request, Response } from "express";
import { Router } from "express";
import * as commandService from "../modules/commandService.ts";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
    res.render("pages/index", {
        title: "SWGoHBot - Discord Bot for Star Wars Galaxy of Heroes",
        description:
            "SWGoHBot brings character stats, guild management, arena tracking, and more to your Discord server. Active on over 10,000 servers.",
    });
});

router.get("/about", (_req: Request, res: Response) => {
    res.render("pages/about", {
        title: "About SWGoHBot",
        description: "Learn about SWGoHBot, a Discord bot for Star Wars Galaxy of Heroes with character stats, guild management, and more.",
    });
});

router.get("/tos", (_req: Request, res: Response) => {
    res.render("pages/tos");
});

router.get("/privacyPolicy", (_req: Request, res: Response) => {
    res.render("pages/privacyPolicy");
});

router.get("/faqs", (_req: Request, res: Response) => {
    res.render("pages/faqs");
});

router.get("/commands", (_req: Request, res: Response) => {
    const commandData = commandService.getCommands();
    res.render("pages/commands", { commandData });
});

router.get("/invite", (_req: Request, res: Response) => {
    res.redirect(
        "https://discord.com/api/oauth2/authorize?client_id=315739499932024834&permissions=277025901632&scope=bot%20applications.commands",
    );
});

router.get("/server", (_req: Request, res: Response) => {
    res.redirect("https://discord.gg/FfwGvhr");
});

router.get("/dashboard", (_req: Request, res: Response) => {
    res.redirect(301, "/config");
});

export default router;
