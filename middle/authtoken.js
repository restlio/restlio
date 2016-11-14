function AuthToken(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _token  = req.headers['x-access-token'];
    const _middle = 'middle.authtoken';
    
    if( ! _token || _token === '' ) {
        return next( _resp.Unauthorized({
            middleware: _middle,
            type: 'InvalidCredentials',
            errors: ['access token not found']}
        ));
    }

    next();
}

module.exports = app => AuthToken;