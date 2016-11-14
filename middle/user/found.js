const async = require('async');

function UserFound(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _schema = _app.lib.schema;
    const _email  = req.body.email;
    const _middle = 'middle.user.found';
    
    if( ! _email || _email === '' ) {
        return next( _resp.Unauthorized({
            middleware: _middle,
            type: 'InvalidCredentials',
            errors: ['email not found']}
        ));
    }

    const obj = {
        email: _email.toLowerCase(),
        qt: 'one'
    };

    new _schema('system.users').init(req, res, next).get(obj, (err, doc) => {
        if(doc) {
            return next( _resp.Unauthorized({
                middleware: _middle,
                type: 'InvalidCredentials',
                errors: ['user found']}
            ));
        }

        next();
    });

}

module.exports = app => UserFound;