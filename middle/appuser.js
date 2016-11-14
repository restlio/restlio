const async = require('async');
const php   = require('phpjs');
const _     = require('underscore');
const s     = require('underscore.string');

function AppUser(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _schema = _app.lib.schema;
    const _middle = 'middle.appuser';
    
    if( ! req.__appId ) {
        return next( _resp.Unauthorized({
            middleware: _middle,
            type: 'InvalidCredentials',
            errors: ['app id not found']}
        ));
    }

    const _profiles = `${req.__appData.slug}.profiles`;
    const _email    = req.body.email;
    const _username = req.body.username;
    const _login    = _email || _username;

    if( ! _login || _login === '' ) {
        return next( _resp.Unauthorized({
            middleware: _middle,    
            type: 'InvalidCredentials',
            errors: ['user credentials not found']}
        ));
    }

    // async object
    const a = {};

    if(_email) {
        a.email = cb => {
            new _schema('system.users').init(req, res, next).get({
                email: _email.toLowerCase(),
                qt: 'one'
            }, (err, doc) => {
                cb(err, doc);
            });
        };
    }
    else if(_username) {
        a.username = cb => {
            const model = new _schema(_profiles).init(req, res, next);

            if( ! model )
                return cb(true);

            model.get({
                username_lc: _username.toLowerCase(),
                qt: 'one'
            }, (err, doc) => {
                if( err || ! doc )
                    return cb(err, doc);

                const userId = doc.users;

                new _schema('system.users').init(req, res, next).getById(userId, (err, doc) => {
                    cb(err, doc);
                });
            });
        };
    }

    async.parallel(a, (err, results) => {

        const paths  = ['/api/social', '/api/social/'];
        const pIndex = paths.indexOf(req.path);

        // yukarıdaki url'ler için http response dönmüyoruz
        if( pIndex == -1 && ! results.email && ! results.username ) {
            return next( _resp.Unauthorized({
                middleware: _middle,
                type: 'InvalidCredentials',
                errors: ['user not found']}
            ));
        }

        req.__userData = results.email || results.username;

        if(req.__userData)
            req.__userData._id = req.__userData._id.toString();

        next();
    });

}

module.exports = app => AppUser;