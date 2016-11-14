function CheckBodyPassword(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _middle = 'middle.check.body.password';
    
    if( ! req.body.password || req.body.password === '' ) {
        return next( _resp.Unauthorized({
            middleware: _middle,
            type: 'InvalidCredentials',
            errors: ['password not found']
        }));
    }

    next();

}

module.exports = app => CheckBodyPassword;