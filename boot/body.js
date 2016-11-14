const body = require('body-parser');

module.exports = app => {

    const _conf = app.lib.bootConf(app, 'body');

    app.use(body.urlencoded(_conf.urlencoded || {}));
    app.use(body.json(_conf.json || {}));
    
    return true;

};




