const path = require('path');
const swig = require('swig');
const swigHelper = require('./helper');
const compress = require('compression');
const express = require('express');
const cookie = require('cookie-parser');
const session = require('express-session');
const Store = require('connect-redis')(session);
const moment = require('moment-timezone');
const flash = require('connect-flash');
const CronJob = require('cron').CronJob;
const kue = require('kue');
const dot = require('dotty');

module.exports = app => {
    const env = app.get('env');
    const helper = app.lib.utils.helper;

    // set view engine
    const viewConf = helper.bootConf('view');
    const viewDir = path.dirname(__dirname);

    app.engine('html', swig.renderFile);
    app.set('view engine', 'html');

    // set both app view and Restlio folders
    app.set('views', [
        `${app.get('basedir')}/${viewConf.dir || 'view'}`,
        `${viewDir}/${viewConf.dir || 'view'}`,
    ]);

    app.set('view cache', env === 'production');
    swig.setDefaults(viewConf.swig || {});
    swigHelper.view(swig); // set view helpers

    // use compression
    app.use(compress());

    // use static
    const staticConf = helper.bootConf('static');
    const staticDir = path.dirname(__dirname);

    app.use(express.static(`${staticDir}/${staticConf.dir || 'public'}`, (staticConf.options || {}) ));
    app.use(express.static(`${app.get('basedir')}/${staticConf.dir || 'public'}`, (staticConf.options || {}) ));

    // use cookie
    app.use(cookie());

    // use session
    const sessConf = helper.bootConf('session') || {};
    sessConf.store = new Store({client: app.core.redis.a});

    // session
    app.use(session(sessConf));
    
    // use timezone
    const timeConf = helper.bootConf('timezone');
    
    app.all('*', (req, res, next) => {
        if( req.session && ! req.session.time && timeConf && timeConf.default ) {
            req.session.time = {name: timeConf.default};
        }

        req.__time = false;
        
        if(req.session.time) {
            const currTz = moment.tz(req.session.time.name);
            const hours = currTz.format('Z');
            // const mins = currTz.zone();
            const mins = currTz.utcOffset();
            
            req.session.time.hours = hours;
            req.session.time.mins = mins;
                    
            req.__time = {
                name: req.session.time.name, hours, mins,
            };
        }
        
        next();
    });

    // use flash
    app.use(flash());

    // set locals
    app.use((req, res, next) => {
        res.locals.req = req;
        res.locals.res = res;
        res.locals.segments = req.url.split('/');
        res.locals.env = env;
        res.locals.config = app.config[env];
        res.locals.now = Date.now();
        res.locals.session = req.session;
        res.locals.flash = req.flash('flash');

        next();
    });

    // check admin route
    app.all('/admin*', app.middle.basic, (req, res, next) => {
        const segment = res.locals.segments[2];
        const routes = ['login', 'logout'];

        if( ! req.session.adminUserId && ! routes.includes(segment) ) {
            return res.redirect('/admin/login');
        }

        next();
        return false;
    });

    // set cronjob
    app.boot.cron = CronJob;

    // set kue
    const workerConf = app.config[env].redis || dot.get(app.config[env], 'data.redis');

    const redisObj = {
        port: workerConf.port,
        host: workerConf.host,
    };

    if(workerConf.pass) {
        redisObj.auth = workerConf.pass;
    }
        
    const queue = kue.createQueue({
        prefix: 'q',
        redis: redisObj,
        disableSearch: true,
        jobEvents: false,
    });

    queue.watchStuckJobs(workerConf.stuckInterval || 5000);

    app.boot.kue = queue;

    // mount kue ui
    app.use('/admin/kue', kue.app);

    // forward by hostname
    const forwardConf = helper.bootConf('forward');

    function forwards(req, res, next) {
        if(forwardConf[req.hostname]) {
            req.url = `/${forwardConf[req.hostname]}${req.url}`;
        }

        next('route');
    }

    app.get('*', forwards);
    app.post('*', forwards);

    return true;
};
