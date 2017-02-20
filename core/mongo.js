const mongoose = require('mongoose');
const dot = require('dotty');
const debug = require('debug');

// enable mongoose promises
mongoose.Promise = Promise;

module.exports = app => {
    const _env = app.get('env');
    const _conf = app.config[_env].mongo || dot.get(app.config[_env], 'data.mongo');
    const _worker = app.get('workerid');
    const log = debug(`RESTLIO:W${_worker}:CORE:MONGO`);
    let _auth = '';

    if( ! _conf ) {
        return log('mongo conf not found!');
    }
    
    if(_conf.user && _conf.pass) {
        _auth = `${_conf.user}:${_conf.pass}@`;
    }

    const str = `mongodb://${_auth}${_conf.host}:${_conf.port}/${_conf.db}`;
    const db = mongoose.connect(str, {
        server: {poolSize: parseInt(_conf.pool, 10) || 10},
        config: {autoIndex: _conf.autoIndex || false},
    });

    // mongoose set event emitter max listeners
    mongoose.connection.setMaxListeners(0);
    mongoose.connection.on('error', err => log(err));
    mongoose.connection.on('open', () => log('client connected'));

    if(_conf.debug) {
        mongoose.set('debug', true);
    }
        
    log('CONFIG %o', _conf);
    log('STRING', str);

    // set core object
    const obj = {db, str, mongoose};
    app.core.mongo = obj;
    app.config[_env].mongo = {str};

    return obj;
};
