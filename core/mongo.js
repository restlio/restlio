const mongoose = require('mongoose');
const dot = require('dotty');
const debug = require('debug');

// enable mongoose promises
// mongoose.Promise = Promise;

module.exports = app => {
    const env = app.get('env');
    const conf = app.config[env].mongo || dot.get(app.config[env], 'data.mongo');
    const worker = app.get('workerid');
    const log = debug(`RESTLIO:W${worker}:CORE:MONGO`);
    let auth = '';

    if( ! conf ) {
        return log('mongo conf not found!');
    }
    
    const {user, pass, host, port, db: database, pool, autoIndex, debug: setDebug} = conf;

    if(user && pass) {
        auth = `${user}:${pass}@`;
    }

    const str = `mongodb://${auth}${host}:${port}/${database}`;
    const db = mongoose.connect(str, {
        server: {poolSize: parseInt(pool, 10) || 10},
        config: {autoIndex: autoIndex || false},
    });

    // mongoose set event emitter max listeners
    mongoose.connection.setMaxListeners(0);
    mongoose.connection.on('error', err => log(err));
    mongoose.connection.on('open', () => log('client connected'));

    if(setDebug) {
        mongoose.set('debug', true);
    }
        
    log('%o', conf);
    log(str);

    // set core object
    const obj = {db, str, mongoose};
    app.core.mongo = obj;
    app.config[env].mongo = {str};

    return obj;
};
