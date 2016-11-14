function TokenInvite(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _schema = _app.lib.schema;
    const _middle = 'middle.token.invite';
    
    new _schema('system.invites').init(req, res, next).get({
        invite_token: req.params.token,
        qt: 'one'
    }, (err, doc) => {
        if( ! doc ) {
            return next( _resp.Unauthorized({
                middleware: _middle,
                type: 'InvalidCredentials',
                errors: ['not found token']
            }));
        }

        const expires = doc.invite_expires.getTime();
        const now     = new Date().getTime();

        if(now > expires) {
            return next( _resp.Unauthorized({
                middleware: _middle,
                type: 'InvalidCredentials',
                errors: ['expired token']
            }));
        }

        req.__inviteData     = doc;
        req.__inviteData._id = doc._id.toString();

        next();
    });

}

module.exports = app => TokenInvite;