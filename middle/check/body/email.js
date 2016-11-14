function CheckBodyEmail(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _email  = req.body.email;
    const _middle = 'middle.check.body.email';
    
    if( ! _email || _email === '' ) {
        return next( _resp.Unauthorized({
            middleware: _middle,
            type: 'InvalidCredentials',
            errors: ['email not found']
        }));
    }

    req.body.email = _email.toLowerCase();

    next();

}

module.exports = app => CheckBodyEmail;