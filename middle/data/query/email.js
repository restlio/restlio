function DataQueryEmail(req, res, next) {
    const _helper = req.app.lib.utils.helper;
    const _schema = req.app.lib.schema;
    const _email  = req.query.email;
    const _middle = 'middle.data.query.email';
    
    if( ! _email || _email === '' ) {
        return _helper.middle(next, _middle, 'user email not found');
    }

    new _schema('system.users').init(req, res, next).get({email: _email, qt: 'one'}, (err, doc) => {
        if( err || ! doc ) {
            return _helper.middle(next, _middle, 'user data not found');
        }

        req.__queryUser     = doc;
        req.__queryUser._id = doc._id.toString();
        next();
    });
}

module.exports = () => DataQueryEmail;
