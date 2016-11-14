const dot = require('dotty');

function DataQueryEmail(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _schema = _app.lib.schema;
    const _email  = req.query.email;
    const _middle = 'middle.data.query.email';
    
    if( ! _email || _email === '' ) {
        return next( _resp.Unauthorized({
            middleware: _middle,
            type: 'InvalidCredentials',
            errors: ['user email not found']
        }));
    }

    new _schema('system.users').init(req, res, next).get({email: _email, qt: 'one'}, (err, doc) => {
        if( err || ! doc ) {
            return next( _resp.Unauthorized({
                middleware: _middle,
                type: 'InvalidCredentials',
                errors: ['user data not found']}
            ));
        }

        req.__queryUser     = doc;
        req.__queryUser._id = doc._id.toString();

        next();
    });

}

module.exports = app => DataQueryEmail;