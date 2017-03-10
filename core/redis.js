const redis = require('redis');
const dot = require('dotty');
const debug = require('debug');

module.exports = (app, cb) => {
    const env = app.get('env');
    const conf = app.config[env].redis || dot.get(app.config[env], 'data.redis');
    const worker = app.get('workerid');
    const log = debug(`RESTLIO:W${worker}:CORE:REDIS`);

    if( ! conf ) {
        return log('redis conf not found!');
    }
        
    const {port, host, pass} = conf;
    const clientA = redis.createClient(port, host);
    const clientB = redis.createClient(port, host);

    if(pass) {
        clientA.auth(pass);
        clientB.auth(pass);
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

    log(conf);
    const obj = {a: clientA, b: clientB};
    app.core.redis = obj;
    return obj;
};
