// Native Node Imports
const url = require("url");
const path = require("path");
// const fs = require("fs");
const join = require("path").join;

// Used for Permission Resolving...
const Discord = require("discord.js");

// Express Session
const express = require("express");
const app = express();
// const moment = require("moment");
const momentTZ = require("moment-timezone");
require("moment-duration-format");

const Sequelize = require("sequelize");
const config = require("./config.js");

// Express Plugins
// Specifically, passport helps with oauth2 in general.
// passport-discord is a plugin for passport that handles Discord's specific implementation.
// express-session and level-session-store work together to create persistent sessions
// (so that when you come back to the page, it still remembers you're logged in).
const passport = require("passport");
const session = require("express-session");
const MongoStore = require("connect-mongo")(session);
const Strategy = require("passport-discord").Strategy;

// Helmet is specifically a security plugin that enables some specific, useful
// headers in your page to enhance security.
const helmet = require("helmet");

// Used to parse Markdown from things like ExtendedHelp
// const md = require("marked");

const initSite = async function() {
    const sequelize = new Sequelize(config.database.data, config.database.user, config.database.pass, {
        host: config.database.host,
        dialect: "postgres",
        logging: false
    });
    const changelogs = sequelize.define("changelogs", {
        logText: Sequelize.TEXT
    });

    var publicDir = join(__dirname, "/public");
    app.use(express.static(publicDir));

    const pageDir = join(__dirname, "/pages");

    // Not used anymore, but could be in the future?
    // let guildCount = await parseInt(fs.readFileSync(path.join(__dirname, path.sep + "/data/guildCount.txt")));
    // setInterval(async () => {
    //     guildCount = await parseInt(fs.readFileSync(path.join(__dirname, path.sep + "/data/guildCount.txt")));
    // }, 5 * 60 * 1000);

    // These are... internal things related to passport. Honestly I have no clue either.
    // Just leave 'em there.
    passport.serializeUser((user, done) => {
        done(null, user);
    });
    passport.deserializeUser((obj, done) => {
        done(null, obj);
    });

    /*
      This defines the **Passport** oauth2 data. A few things are necessary here.

      clientID = Your bot's client ID, at the top of your app page. Please note,
        older bots have BOTH a client ID and a Bot ID. Use the Client one.
      clientSecret: The secret code at the top of the app page that you have to
        click to reveal. Yes that one we told you you'd never use.
      callbackURL: The URL that will be called after the login. This URL must be
        available from your PC for now, but must be available publically if you're
        ever to use this dashboard in an actual bot.
      scope: The data scopes we need for data. identify and guilds are sufficient
        for most purposes. You might have to add more if you want access to more
        stuff from the user. See: https://discordapp.com/developers/docs/topics/oauth2
      See config.js.example to set these up.
      */
    passport.use(new Strategy({
        clientID: "315739499932024834",
        clientSecret: config.dashboard.oauthSecret,
        callbackURL: config.dashboard.callbackURL,
        scope: ["identify", "guilds"]
    },
    (accessToken, refreshToken, profile, done) => {
        process.nextTick(() => done(null, profile));
    }));


    // Session data, used for temporary storage of your visitor's session information.
    // the `secret` is in fact a "salt" for the data, and should not be shared publicly.
    app.use(session({
        store: new MongoStore({
            url: config.mongo.url
        }),
        secret: config.dashboard.sessionSecret,
        resave: false,
        saveUninitialized: false,
    }));

    // Initializes passport and session.
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(helmet());

    // The domain name used in various endpoints to link between pages.
    app.locals.domain = config.dashboard.domain;

    // The EJS templating engine gives us more power to create complex web pages.
    // This lets us have a separate header, footer, and "blocks" we can use in our pages.
    app.engine("html", require("ejs").renderFile);
    app.set("view engine", "html");

    // body-parser reads incoming JSON or FORM data and simplifies their
    // use in code.
    var bodyParser = require("body-parser");
    app.use(bodyParser.json()); // to support JSON-encoded bodies
    app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
        extended: true
    }));

    /*
    Authentication Checks. For each page where the user should be logged in, double-checks
    whether the login is valid and the session is still active.
    */
    function checkAuth(req, res, next) {
        if (req.isAuthenticated()) return next();
        req.session.backURL = req.url;
        res.redirect("/login");
    }

    // Set the directory for the views and stuff
    app.set("views", path.join(__dirname, `..${path.sep}dashboard`));

    // Set the view engine to ejs
    app.set("view engine", "ejs");

    // This function simplifies the rendering of the page, since every page must be rendered
    // with the passing of these 4 variables, and from a base path.
    // Objectassign(object, newobject) simply merges 2 objects together, in case you didn't know!
    const renderPage = (res, req, page, data = {}) => {
        const baseData = {
            path: req.path,
            user: req.isAuthenticated() ? req.user : null
        };
        if (baseData.user) {
            baseData.user.avatarURL = `https://cdn.discordapp.com/avatars/${baseData.user.id}/${baseData.user.avatar}.png?size=32`;
        }
        res.render(path.resolve(`${pageDir}${path.sep}${page}`), Object.assign(baseData, data));
    };

    // The login page saves the page the person was on in the session,
    // then throws the user to the Discord OAuth2 login page.
    app.get("/login", (req, res, next) => {
        if (req.session.backURL) {
            // req.session.backURL = req.session.backURL;
        } else if (req.headers.referer) {
            const parsed = url.parse(req.headers.referer);
            if (parsed.hostname === app.locals.domain) {
                req.session.backURL = parsed.path;
            }
        } else {
            req.session.backURL = "/";
        }
        next();
    },
    passport.authenticate("discord")
    );

    // Once the user returns from OAuth2, this endpoint gets called.
    // Here we check if the user was already on the page and redirect them
    // there, mostly.
    app.get("/callback", passport.authenticate("discord", {
        failureRedirect: "/autherror"
    }), (req, res) => {
        if (req.user.id === "124579977474736129") {
            req.session.isAdmin = true;
        } else {
            req.session.isAdmin = false;
        }
        if (req.session.backURL) {
            const url = req.session.backURL;
            req.session.backURL = null;
            res.redirect(url);
        } else {
            res.redirect("/");
        }
    });
    // If an error happens during authentication, this is what's displayed.
    app.get("/autherror", (req, res) => {
        // TODO  Need to swap this out since it doesn't exist here
        renderPage(res, req, "autherror.ejs");
    });

    // Destroys the session to log out the user.
    app.get("/logout", function(req, res) {
        req.session.destroy(() => {
            req.logout();
            res.redirect("/"); //Inside a callback… bulletproof!
        });
    });




    // Index page
    app.get("/", function(req, res) {
        renderPage(res, req, "index.ejs");
    });

    // Test home page/ logged in?
    // app.get("/test", function(req, res) {
    //     renderPage(res, req, "test-index.ejs");
    // });

    // About page
    app.get("/about", function(req, res) {
        renderPage(res, req, "about.ejs");
    });

    // Changelog page
    app.get("/changelog", async function(req, res) {
        await changelogs.findAll().then(function(logs) {
            const logList = [];
            const sortedLogs = logs.sort((p, c) => c.dataValues.createdAt - p.dataValues.createdAt);
            sortedLogs.forEach(log => {
                logList.push(`<strong><font color="gray">${momentTZ.tz(log.dataValues.createdAt, "us/pacific").format("M/D/YYYY [at] h:mm a")}</font></strong></br>${log.dataValues.logText.replace(/\n/g, "</br>")}`);
            });

            renderPage(res, req, "changelog.ejs", {
                changelogs: logList
            });
        });
    });

    // Changelog Specific page
    app.get("/changelog/:logID", async function(req, res) {
        let id = {};
        if (!parseInt(req.params.logID)) {
            console.log("Broke trying to get log #" + req.params.logID);
        } else {
            id = {
                id: req.params.logID
            };
        }
        await changelogs.findAll({
            where: id
        }).then(function(logs) {
            const logList = [];
            const sortedLogs = logs.sort((p, c) => c.dataValues.createdAt - p.dataValues.createdAt);
            sortedLogs.forEach(log => {
                logList.push(`<strong><font color="gray">${momentTZ.tz(log.dataValues.createdAt, "us/pacific").format("M/D/YYYY [at] h:mm a")}</font></strong></br>${log.dataValues.logText.replace(/\n/g, "</br>")}`);
            });

            renderPage(res, req, "changelog.ejs", {
                changelogs: logList
            });
        });
    });

    // FAQs page
    app.get("/faqs", function(req, res) {
        renderPage(res, req, "faqs.ejs");
    });

    // Commands page
    app.get("/commands", function(req, res) {
        renderPage(res, req, "commands.ejs");
    });

    // Base dashboard page
    app.get("/dashboard", checkAuth, (req, res) => {
        const perms = Discord.EvaluatedPermissions;
        renderPage(res, req, "dashboard.ejs", {perms});
    });

    // The link to invite the bot
    app.get("/invite", function(req, res) {
        res.redirect("https://discordapp.com/oauth2/authorize/?permissions=378944&scope=bot&client_id=315739499932024834");
    });

    // The link to join the support server
    app.get("/server", function(req, res) {
        res.redirect("https://discord.gg/FfwGvhr");
    });

    app.use(function(err, req, res, next) { // eslint-disable-line no-unused-vars
        console.error(err.stack);
        res.status(500).send("Something broke!");
    });

    // The 404 Route
    app.use("", function(req, res) {
        res.status(404).send("Error 404: Not Found!");
    });

    // Turn the site on
    app.listen(config.dashboard.port, function() {
        console.log(`Site listening on port ${config.dashboard.port}!`);
    });
};

initSite();
