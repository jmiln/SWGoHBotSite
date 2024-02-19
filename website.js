// Native Node Imports
// const url = require("url");
const path = require("path");
// const fs = require("fs");

// Express Session
const express = require("express");
const app = express();

const config = require("./config.js");

const initSite = async function() {
    var publicDir = require("path").join(__dirname,"/public");
    app.use(express.static(publicDir));

    // Not used anymore, but could be in the future? (Could probably have the bot save these to a file every hour or something?)
    // let guildCount = await parseInt(fs.readFileSync(path.join(__dirname, path.sep + "/data/guildCount.txt")));
    // setInterval(async () => {
    //     guildCount = await parseInt(fs.readFileSync(path.join(__dirname, path.sep + "/data/guildCount.txt")));
    // }, 5 * 60 * 1000);

    // Set the directory for the views and stuff
    app.set("views", path.join(__dirname, `..${path.sep}dashboard`));

    // Set the view engine to ejs
    app.set("view engine", "ejs");

    // Index page
    app.get("/", function(req, res) {
        res.render("pages/index");
    });

    // About page
    app.get("/about", function(req, res) {
        res.render("pages/about");
    });

    // ToS page
    app.get("/tos", function(req, res) {
        res.render("pages/tos");
    });

    // Privacy Policy page
    app.get("/privacyPolicy", function(req, res) {
        res.render("pages/privacyPolicy");
    });

    // FAQs page
    app.get("/faqs",function(req, res) {
        res.render("pages/faqs");
    });

    // Commands page
    app.get("/commands",function(req, res) {
        res.render("pages/commands");
    });
    app.get("/test-commands",function(req, res) {
        res.render("pages/test-commands");
    });

    // The link to invite the bot
    app.get("/invite", function(req, res) {
        res.redirect("https://discord.com/api/oauth2/authorize?client_id=315739499932024834&permissions=277025901632&scope=bot%20applications.commands");
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
    app.use("",function(req, res) {
        res.status(404).send("Error 404: Not Found!");
    });

    // Turn the site on
    app.listen(config.dashboard.port, function() {
        console.log(`Site listening on port ${config.dashboard.port}!`);
    });
};

initSite();
