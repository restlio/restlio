const kue = require('kue');
const dot = require('dotty');

module.exports = app => {

    const _env  = app.get('env');
    const _conf = app.config[_env].redis || dot.get(app.config[_env], 'data.redis');

    const redisObj = {
        port: _conf.port,
        host: _conf.host
    };

    if(_conf.pass)
        redisObj.auth = _conf.pass;

    const queue = kue.createQueue({
        prefix: 'q',
        redis: redisObj,
        disableSearch: true,
        jobEvents: false
    });

    queue.watchStuckJobs(_conf.stuckInterval || 5000);
    
    return queue;

};




