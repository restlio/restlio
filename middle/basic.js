const basicAuth = require('basic-auth');

function BasicAuth(req, res, next) {

    const _app  = req.app;
    const _env  = _app.get('env');
    const _conf = _app.config[_env].middle.basic;

    if( ! _conf.enabled )
        return next();

    function unauthorized(res) {
        res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
        return res.sendStatus(401);
    }

    const user = basicAuth(req);

    if ( ! user || ! user.name || ! user.pass)
        return unauthorized(res);

    if (user.name === _conf.user && user.pass === _conf.pass)
        return next();
    else
        return unauthorized(res);

}

module.exports = app => BasicAuth;

