const session = require('express-session');
const store   = require('connect-redis')(session);

module.exports = app => {

    // get config
    let _conf   = app.lib.bootConf(app, 'session');
    _conf       = _conf || {};
    _conf.store = new store({client: app.core.redis.a});

    // session
    app.use(session(_conf));
    
    return true;
    
};




