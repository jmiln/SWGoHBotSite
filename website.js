const express = require('express');
const app = express();
const path = require('path');
const momentTZ = require('moment-timezone');
const Sequelize = require('sequelize');
const config = require('./config.json');

initSite = async function() {
    const sequelize = new Sequelize(config.database.data, config.database.user, config.database.pass, {
        host: config.database.host,
        dialect: 'postgres',
        logging: false,
        operatorAliases: false
    });
    const changelogs = sequelize.define('changelogs', {
        logText: Sequelize.TEXT
    });
    
    // Set the directory for the views and stuff
    app.set("views", path.join(__dirname, `..${path.sep}dashboard`));

    // Set the view engine to ejs
    app.set('view engine', 'ejs');

    // Index page
    app.get('/', function(req, res) {
        res.render('pages/index', {
            // clientServers: client.guilds.size,
            page_name: 'index'
        });
    });

    // About page
    app.get('/about', function(req, res) {
        res.render('pages/about', {
            page_name: 'about'
        });
    });

    // Changelog page
    app.get('/changelog', async function(req, res) {
        await changelogs.findAll().then(function(logs) { 
            const logList = [];
            const sortedLogs = logs.sort((p, c) => c.dataValues.createdAt - p.dataValues.createdAt);
            sortedLogs.forEach(log => {
                logList.push(`<strong><font color="gray">${momentTZ.tz(log.dataValues.createdAt, 'us/pacific').format('M/D/YYYY [at] h:mm a')}</font></strong></br>${log.dataValues.logText.replace(/\n/g, '</br>')}`);
            });

            res.render('pages/changelog', {
                changelogs: logList,
                page_name: 'changelog'
            });
        });
    });

    // FAQs page
    app.get('/faqs',function(req, res) {
        res.render('pages/faqs', {
            page_name: 'faqs'
        });
    });

    // Commands page 
    app.get('/commands',function(req, res) {
        res.render('pages/commands', {
            page_name: 'commands',
        });
    });

    // The link to invite the bot
    app.get('/invite', function(req, res) {
        res.redirect('https://discordapp.com/oauth2/authorize?permissions=67624000&scope=bot&client_id=315739499932024834');
    });

    // The link to join the support server
    app.get('/server', function(req, res) {
        res.redirect('https://discord.gg/FfwGvhr');
    });

    app.use(function(err, req, res, next) { // eslint-disable-line no-unused-vars
        console.error(err.stack);
        res.status(500).send('Something broke!');
    });

    // The 404 Route 
    app.use('',function(req, res) {
        res.status(404).send('Error 404: Not Found!');
    });

    // Turn the site on
    app.listen(config.dashboard.port, function() {
        console.log(`Site listening on port ${config.dashboard.port}!`);
    });
};

initSite();
