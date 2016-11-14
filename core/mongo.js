const mongoose = require('mongoose');
const dot      = require('dotty');

module.exports = app => {

    const _env    = app.get('env');
    const _log    = app.lib.logger;
    const _conf   = app.config[_env].mongo || dot.get(app.config[_env], 'data.mongo');
    let _auth   = '';
    const _worker = app.get('workerid');
    const _sConf  = app.config[_env].sync;
    const _logs   = dot.get(_sConf, 'data.core');
    const _group  = `W${_worker}:CORE:MONGO`;

    if( ! _conf ) {
        _log.info(_group, 'mongo conf not found!', 'red');
        return false;
    }
    
    if(_conf.user && _conf.pass)
        _auth = `${_conf.user}:${_conf.pass}@`;

    const str = `mongodb://${_auth}${_conf.host}:${_conf.port}/${_conf.db}`;
    const db  = mongoose.connect(str, {
        server: {poolSize: parseInt(_conf.pool) || 10},
        config: {autoIndex: _conf.autoIndex || false}
    });

    // mongoose set event emitter max listeners
    mongoose.connection.setMaxListeners(0);

    mongoose.connection.on('error', err => {
        _log.error(_group, err);
    });

    mongoose.connection.on('open', () => {
        if(_logs)
            _log.info(_group, 'client connected', 'black');
    });

    if(_conf.debug)
        mongoose.set('debug', true);
        
    if(_logs) {
        _log.info(`${_group}:CONFIG`, _conf, 'black');
        _log.info(`${_group}:STRING`, str, 'black');
    }

    // set core object
    const obj = {db, str, mongoose};
    app.core.mongo = obj;
    return obj;

};