function CheckBodyDetail(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _middle = 'middle.check.body.detail';
    
    if( ! req.body.detail || req.body.detail === '' ) {
        return next( _resp.Unauthorized({
            middleware: _middle,
            type: 'InvalidCredentials',
            errors: ['detail not found']
        }));
    }

    next();

}

module.exports = app => CheckBodyDetail;