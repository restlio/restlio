function AppData(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _schema = _app.lib.schema;
    const _middle = 'middle.appdata';
    
    if( ! req.__appId ) {
        return next( _resp.Unauthorized({
            middleware: _middle,
            type: 'InvalidCredentials',
            errors: ['app id not found']}
        ));
    }

    new _schema('system.apps').init(req, res, next).getById(req.__appId, (err, doc) => {
        if( ! doc ) {
            return next( _resp.Unauthorized({
                middleware: _middle,
                type: 'InvalidCredentials',
                errors: ['app not found']}
            ));
        }

        req.__appData     = doc;
        req.__appData._id = doc._id.toString();

        next();
    });

}

module.exports = app => AppData;