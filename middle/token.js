exports.invite = (req, res, next) => {
    const _helper = req.app.lib.utils.helper;
    const _schema = req.app.lib.schema;
    const _middle = 'middle.token.invite';
    
    new _schema('system.invites').init(req, res, next).get({
        invite_token: req.params.token,
        qt: 'one',
    }, (err, doc) => {
        if( ! doc ) {
            return _helper.middle(next, _middle, 'not found token');
        }

        const expires = doc.invite_expires.getTime();
        const now     = new Date().getTime();

        if(now > expires) {
            return _helper.middle(next, _middle, 'expired token');
        }

        req.__inviteData     = doc;
        req.__inviteData._id = doc._id.toString();

        next();
    });
};

exports.reset = (req, res, next) => {
    const _helper = req.app.lib.utils.helper;
    const _schema = req.app.lib.schema;
    const _middle = 'middle.token.reset';
    
    new _schema('system.users').init(req, res, next).get({
        reset_token: req.params.token,
        qt: 'one',
    }, (err, doc) => {
        if( ! doc ) {
            return _helper.middle(next, _middle, 'not found token');
        } else if(doc.is_enabled === 'No') {
            return _helper.middle(next, _middle, 'not enabled user');
        }

        const expires = doc.reset_expires.getTime();
        const now     = new Date().getTime();

        if(now > expires) {
            return _helper.middle(next, _middle, 'expired token');
        }

        req.__userData     = doc;
        req.__userData._id = doc._id.toString();
        next();
    });
};

exports.verify = (req, res, next) => {
    const _helper = req.app.lib.utils.helper;
    const _schema = req.app.lib.schema;
    const _middle = 'middle.token.verify';
    
    new _schema('system.users').init(req, res, next).get({
        register_token: req.params.token,
        qt: 'one',
    }, (err, doc) => {
        if( ! doc ) {
            return _helper.middle(next, _middle, 'not found token');
        } else if(doc.is_enabled === 'Yes') {
            return _helper.middle(next, _middle, 'enabled user');
        }

        req.__userData     = doc;
        req.__userData._id = doc._id.toString();
        next();
    });
};
