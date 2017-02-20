const path = require('path');
const swig = require('swig');
const helper = require('./helper');
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
};
