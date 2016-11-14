function TokenVerify(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _schema = _app.lib.schema;
    const _middle = 'middle.token.verify';
    
    new _schema('system.users').init(req, res, next).get({
        register_token: req.params.token,
        qt: 'one'
    }, (err, doc) => {
        if( ! doc ) {
            return next( _resp.Unauthorized({
                middleware: _middle,
                type: 'InvalidCredentials',
                errors: ['not found token']
            }));
        }
        else if(doc.is_enabled == 'Yes') {
            return next( _resp.Unauthorized({
                middleware: _middle,
                type: 'InvalidCredentials',
                errors: ['enabled user']
            }));
        }

        req.__userData     = doc;
        req.__userData._id = doc._id.toString();

        next();
    });

}

module.exports = app => TokenVerify;