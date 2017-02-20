const redis = require('redis');
const dot = require('dotty');
const debug = require('debug');

module.exports = (app, cb) => {
    const _env = app.get('env');
    const _conf = app.config[_env].redis || dot.get(app.config[_env], 'data.redis');
    const _worker = app.get('workerid');
    const log = debug(`RESTLIO:W${_worker}:CORE:REDIS`);

    if( ! _conf ) {
        return log('redis conf not found!');
    }
        
    const clientA = redis.createClient(_conf.port, _conf.host);
    const clientB = redis.createClient(_conf.port, _conf.host);

    if(_conf.pass) {
        clientA.auth(_conf.pass);
        clientB.auth(_conf.pass);
    }

    let conn = 0;
    clientA.on('connect', () => {
        log('client A connected');
        conn += 1;
        if(conn === 2) cb();
    });

    clientA.on('error', err => log(err.message));

    clientB.on('connect', () => {
        log('client B connected');
        conn += 1;
        if(conn === 2) cb();
    });

    clientB.on('error', err => log(err.message));

    log(_conf);
    const obj = {a: clientA, b: clientB};
    app.core.redis = obj;
    return obj;
};
