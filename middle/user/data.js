function UserData(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _schema = _app.lib.schema;
    const _middle = 'middle.user.data';
    
    if( ! req.__user || ! req.__user.id ) {
        return next( _resp.Unauthorized({
            middleware: _middle,
            type: 'InvalidCredentials',
            errors: ['user not found']}
        ));
    }

    new _schema('system.users').init(req, res, next).getById(req.__user.id, (err, doc) => {
        if( err || ! doc ) {
            return next( _resp.Unauthorized({
                middleware: _middle,
                type: 'InvalidCredentials',
                errors: ['user not found']}
            ));
        }

        req.__userData     = doc;
        req.__userData._id = doc._id.toString();

        next();
    });
}

module.exports = app => UserData;