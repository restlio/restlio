function Client(req, res, next) {
    const _helper = req.app.lib.utils.helper;
    const _schema = req.app.lib.schema;
    const _middle = 'middle.client';
    
    // headers
    const _clientId     = req.headers['x-client-id'];
    const _clientSecret = req.headers['x-client-secret'];
        
    if( ! _clientId || _clientId === '' || ! _clientSecret || _clientSecret === '' ) {
        return _helper.middle(next, _middle, 'check your client id and client secret headers');
    }

    new _schema('oauth.clients').init(req, res, next).get({
        clientId: _clientId,
        clientSecret: _clientSecret,
        qt: 'one',
    },
    (err, doc) => {
        if( err || ! doc ) {
            return _helper.middle(next, _middle, 'check your client id and client secret data');
        }

        req.__appId = doc.apps.toString();
        next();
    });
}

module.exports = () => Client;
