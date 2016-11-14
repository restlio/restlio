function UserEnabled(req, res, next) {

    const _app      = req.app;
    const _env      = _app.get('env');
    const _resp     = _app.system.response.app;
    const _schema   = _app.lib.schema;
    const _userData = req.__userData;
    const paths     = ['/api/social', '/api/social/'];
    const pIndex    = paths.indexOf(req.path);
    const _middle   = 'middle.user.enabled';
    
    // yukarıdaki path'ler için user data kontrol etmiyoruz
    if( pIndex == -1 && ! _userData ) {
        return next( _resp.Unauthorized({
            middleware: _middle,
            type: 'InvalidCredentials',
            errors: ['not found user data']
        }));
    }
    else if(_userData && _userData.is_enabled == 'No') {
        return next( _resp.Unauthorized({
            middleware: _middle,
            type: 'InvalidCredentials',
            errors: ['not enabled user']
        }));
    }

    next();

}

module.exports = app => UserEnabled;