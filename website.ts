// Native Node Imports & Express Session
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ErrorRequestHandler, Request, Response } from "express";
import express from "express";

// Local modules
import * as commandService from "./modules/commandService.ts";

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

const initSite = async (): Promise<void> => {
    const publicDir = path.join(__dirname, "/public");
    app.use(express.static(publicDir));

    // Initialize command service cache
    console.log("Loading bot command data...");
    commandService.initialize();

    // Not used anymore, but could be in the future? (Could probably have the bot save these to a file every hour or something?)
    // let guildCount = await parseInt(fs.readFileSync(path.join(__dirname, path.sep + "/data/guildCount.txt")));
    // setInterval(async () => {
    //     guildCount = await parseInt(fs.readFileSync(path.join(__dirname, path.sep + "/data/guildCount.txt")));
    // }, 5 * 60 * 1000);

    // Set the directory for the views and stuff
    app.set("views", __dirname);

    // Set the view engine to ejs
    app.set("view engine", "ejs");

    // Index page
    app.get("/", (_req: Request, res: Response) => {
        res.render("pages/index");
    });

    // About page
    app.get("/about", (_req: Request, res: Response) => {
        res.render("pages/about", {
            title: "About SWGoHBot",
            description:
                "Learn about SWGoHBot, a Discord bot for Star Wars Galaxy of Heroes with character stats, guild management, and more.",
        });
    });

    // ToS page
    app.get("/tos", (_req: Request, res: Response) => {
        res.render("pages/tos");
    });

    // Privacy Policy page
    app.get("/privacyPolicy", (_req: Request, res: Response) => {
        res.render("pages/privacyPolicy");
    });

    // FAQs page
    app.get("/faqs", (_req: Request, res: Response) => {
        res.render("pages/faqs");
    });

    // Commands page - dynamic from bot data
    app.get("/commands", (_req: Request, res: Response) => {
        const commandData = commandService.getCommands();
        res.render("pages/commands", { commandData });
    });

    app.get("/test-commands", (_req: Request, res: Response) => {
        res.render("pages/test-commands");
    });

    // The link to invite the bot
    app.get("/invite", (_req: Request, res: Response) => {
        res.redirect(
            "https://discord.com/api/oauth2/authorize?client_id=315739499932024834&permissions=277025901632&scope=bot%20applications.commands",
        );
    });

    // The link to join the support server
    app.get("/server", (_req: Request, res: Response) => {
        res.redirect("https://discord.gg/FfwGvhr");
    });

    // Error handler
    const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
        console.error(err.stack);
        res.status(500).send("Something broke!");
    };
    app.use(errorHandler);

    // The 404 Route
    app.use((_req: Request, res: Response) => {
        res.status(404).send("Error 404: Not Found!");
    });

    // Turn the site on
    const port = Number.parseInt(process.env.PORT || "3300", 10);
    app.listen(port, () => {
        console.log(`Site listening on port ${port}!`);
    });
};

initSite();
