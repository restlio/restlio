const redis = require('redis');
const dot   = require('dotty');

module.exports = (app, cb) => {

    const _env    = app.get('env');
    const _conf   = app.config[_env].redis || dot.get(app.config[_env], 'data.redis');
    const _log    = app.lib.logger;
    const _worker = app.get('workerid');
    const _sConf  = app.config[_env].sync;
    const _logs   = dot.get(_sConf, 'data.core');
    const _group  = `W${_worker}:CORE:REDIS`;

    if( ! _conf ) {
        _log.info(_group, 'redis conf not found!', 'red');
        return false;
    }

    const clientA = redis.createClient(_conf.port, _conf.host);
    const clientB = redis.createClient(_conf.port, _conf.host);

    if(_conf.pass) {
        clientA.auth(_conf.pass);
        clientB.auth(_conf.pass);
    }

    let conn = 0;
    clientA.on('connect', () => {
        if(_logs)
            _log.info(_group, 'client A connected', 'black');

        conn++;
        if(conn == 2) cb();
    });

    clientB.on('connect', () => {
        if(_logs)
            _log.info(_group, 'client B connected', 'black');

        conn++;
        if(conn == 2) cb();
    });

    if(_logs)
        _log.info(_group, _conf, 'black');

    const obj = {a: clientA, b: clientB};
    app.core.redis = obj;
    return obj;
    
};