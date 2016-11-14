function CheckBodyUserid(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _userId = req.body.user_id;
    const _middle = 'middle.check.body.userid';
    
    if( ! _userId || _userId === '' ) {
        return next( _resp.Unauthorized({
            middleware: _middle,
            type: 'InvalidCredentials',
            errors: ['user id not found']
        }));
    }

    next();

}

module.exports = app => CheckBodyUserid;