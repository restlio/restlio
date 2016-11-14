function UserProfile(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _schema = _app.lib.schema;
    const _middle = 'middle.user.profile';
    
    if( ! req.__user || ! req.__user.id ) {
        return next( _resp.Unauthorized({
            middleware: _middle,
            type: 'InvalidCredentials',
            errors: ['user not found']}
        ));
    }

    const _profiles = `${req.__appData.slug}.profiles`;
    const _model    = new _schema(_profiles).init(req, res, next);

    if( ! _model ) {
        return next( _resp.Unauthorized({
            middleware: _middle,
            type: 'InvalidCredentials',
            errors: ['profile model not found']}
        ));
    }

    _model.get({users: req.__user.id, qt: 'one'}, (err, doc) => {
        if( err || ! doc ) {
            return next( _resp.Unauthorized({
                middleware: _middle,
                type: 'InvalidCredentials',
                errors: ['profile not found']}
            ));
        }

        req.__profileData     = doc;
        req.__profileData._id = doc._id.toString();

        next();
    });

}

module.exports = app => UserProfile;