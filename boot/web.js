const path = require('path');
const swig = require('swig');
const helper = require('./helper');
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
    const _env = app.get('env');
    const _helper = app.lib.utils.helper;

    // set view engine
    const _viewConf = _helper.bootConf('view');
    const _viewDir = path.dirname(__dirname);

    app.engine('html', swig.renderFile);
    app.set('view engine', 'html');

    // set both app view and Restlio folders
    app.set('views', [
        `${app.get('basedir')}/${_viewConf.dir || 'view'}`,
        `${_viewDir}/${_viewConf.dir || 'view'}`,
    ]);

    app.set('view cache', _env === 'production');
    swig.setDefaults(_viewConf.swig || {});
    helper.view(swig); // set view helpers

    // use compression
    app.use(compress());

    // use static
    const _staticConf = _helper.bootConf('static');
    const _staticDir = path.dirname(__dirname);

    app.use(express.static(`${_staticDir}/${_staticConf.dir || 'public'}`, (_staticConf.options || {}) ));
    app.use(express.static(`${app.get('basedir')}/${_staticConf.dir || 'public'}`, (_staticConf.options || {}) ));

    // use cookie
    app.use(cookie());

    // use session
    const _sessConf = _helper.bootConf('session') || {};
    _sessConf.store = new Store({client: app.core.redis.a});

    // session
    app.use(session(_sessConf));
    
    // use timezone
    const _timeConf = _helper.bootConf('timezone');
    
    app.all('*', (req, res, next) => {
        if( req.session && ! req.session.time && _timeConf && _timeConf.default ) {
            req.session.time = {name: _timeConf.default};
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
        res.locals.env = _env;
        res.locals.config = app.config[_env];
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
    const _workerConf = app.config[_env].redis || dot.get(app.config[_env], 'data.redis');

    const redisObj = {
        port: _workerConf.port,
        host: _workerConf.host,
    };

    if(_workerConf.pass) {
        redisObj.auth = _workerConf.pass;
    }
        
    const queue = kue.createQueue({
        prefix: 'q',
        redis: redisObj,
        disableSearch: true,
        jobEvents: false,
    });

    queue.watchStuckJobs(_workerConf.stuckInterval || 5000);

    app.boot.kue = queue;

    // mount kue ui
    app.use('/admin/kue', kue.app);

    // forward by hostname
    const _forwardConf = _helper.bootConf('forward');

    function forwards(req, res, next) {
        if(_forwardConf[req.hostname]) {
            req.url = `/${_forwardConf[req.hostname]}${req.url}`;
        }

        next('route');
    }

    app.get('*', forwards);
    app.post('*', forwards);

    return true;
};
