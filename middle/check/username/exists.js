const dot = require('dotty');

function CheckUsernameExists(req, res, next) {

    const _app      = req.app;
    const _env      = _app.get('env');
    const _resp     = _app.system.response.app;
    const _schema   = _app.lib.schema;
    const _username = req.body.username;
    const _middle   = 'middle.check.username.exists';
    
    // eğer username gelmediyse herhangi bir kontrol yapma
    if( ! _username || _username === '' )
        return next();

    const profiles = `${req.__appData.slug}.profiles`;

    if(dot.get(req.app.model, profiles)) {
        new _schema(profiles).init(req, res, next).get({
            username_lc: _username.toLowerCase(),
            qt: 'one'
        }, (err, doc) => {
            const paths  = ['/api/social', '/api/social/'];
            const pIndex = paths.indexOf(req.path);

            if(pIndex == -1 && doc) {
                return next( _resp.Unauthorized({
                    middleware: _middle,
                    type: 'InvalidCredentials',
                    errors: ['username exists']}
                ));
            }

            if(doc)
                req.__usernameExists = true;

            next();
        });
    }
    else
        next();

}

module.exports = app => CheckUsernameExists;