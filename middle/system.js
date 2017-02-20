function System(req, res, next) {
    const _helper = req.app.lib.utils.helper;
    const _schema = req.app.lib.schema;
    const _middle = 'middle.system';
    
    const method = req.method.toLowerCase();
    const object = req.params.object;

    // eğer sistem objesi değil ise app id'yi almıyoruz
    // (system.users modelinde app id yok, ama system.users ile direkt obje api'si aracılığı ile iletişime geçilmeyecek)
    if( ! object.includes('system.') ) {
        return next();
    }

    // headers
    const _clientId     = req.headers['x-client-id'];
    const _clientSecret = req.headers['x-client-secret'];

    if( ! _clientId || _clientId === '' || ! _clientSecret || _clientSecret === '' ) {
        return _helper.middle(next, _middle, 'check your client id and client secret params');
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

        if(doc.apps) {
            req.__systemAppId = doc.apps.toString();
        }

        next();
    });
}

module.exports = () => System;
