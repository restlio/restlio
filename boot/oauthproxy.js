const oauthshim = require('oauth-shim');

module.exports = app => {

    const _conf = app.lib.bootConf(app, 'oauthproxy');
    
    app.all('/api/oauthproxy', oauthshim);
    oauthshim.init(_conf);
    
    return true;
    
};






