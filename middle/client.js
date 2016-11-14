function Client(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _schema = _app.lib.schema;
    const _middle = 'middle.client';
    
    // headers
    const _clientId     = req.headers['x-client-id'];
    const _clientSecret = req.headers['x-client-secret'];
        
    if( ! _clientId || _clientId === '' || ! _clientSecret || _clientSecret === '' ) {
        return next( _resp.Unauthorized({
            middleware: _middle,
            type: 'InvalidCredentials',
            errors: ['check your client id and client secret headers']}
        ));
    }

    new _schema('oauth.clients').init(req, res, next).get({
        clientId: _clientId,
        clientSecret: _clientSecret,
        qt: 'one'
    },
    (err, doc) => {
        if( err || ! doc ) {
            return next( _resp.Unauthorized({
                middleware: _middle,
                type: 'InvalidCredentials',
                errors: ['check your client id and client secret data']}
            ));
        }

        req.__appId = doc.apps.toString();

        next();
    });

}

module.exports = app => Client;

