function error(err, req, res, next) {

    const _app = req.app;
    const _log = _app.system.logger;
    const _api = res.__api || res.__json;

    // error
    const code    = err.code || 500;
    const name    = err.name || 'InternalServerError';
    const message = err.message || false;
    const type    = err.type || false;

    // console.log(err);
    _log.error(err.stack);

    const response = {
        meta: {
            name,
            code
        }
    };

    if(message)
        response.meta.message = message;

    if(type)
        response.meta.type = type;

    if( ! _api && code == 500)
        return res.render('admin/error/500');

    res.status(code).json(response);

}

function notFound(req, res, next) {
    next( req.app.system.response.app.NotFound() );
}

module.exports = app => {

    app.all('*', notFound);
    app.use(error);

    return true;

};