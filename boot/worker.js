const path = require('path');
const swig = require('swig');
const swigHelper = require('./helper');
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
};
