const dot = require('dotty');

exports.acl = (object, perm) => {
    let slug = object.replace('.', '_');
    
    return (req, res, next) => {
        const _helper = req.app.lib.utils.helper;
        const _middle = 'middle.user.acl';
        
        req.app.acl.allowedPermissions(req.__user.id, slug, (err, results) => {
            let perms = dot.get(results, slug);

            if( err || ! perms ) {
                return _helper.middle(next, _middle, 'not found acl perms');
            } else if( ! perms.length ) {
                return _helper.middle(next, _middle, 'not found acl perms length');
            }
                
            if(perm && ! perms.includes(perm)) {
                return _helper.middle(next, _middle, 'not allowed acl perms');
            }
            
            perms = slug = null;
            next();
        });
    };
};

exports.data = (req, res, next) => {
    const _helper = req.app.lib.utils.helper;
    const _schema = req.app.lib.schema;
    const _middle = 'middle.user.data';
    
    if( ! req.__user || ! req.__user.id ) {
        return _helper.middle(next, _middle, 'request user not found');
    }

    new _schema('system.users').init(req, res, next).getById(req.__user.id, (err, doc) => {
        if( err || ! doc ) {
            return _helper.middle(next, _middle, 'user data not found');
        }

        req.__userData     = doc;
        req.__userData._id = doc._id.toString();
        next();
    });
};

exports.enabled = (req, res, next) => {
    const _helper   = req.app.lib.utils.helper;
    const _schema   = req.app.lib.schema;
    const _userData = req.__userData;
    const paths     = ['/api/social', '/api/social/'];
    const pIndex    = paths.indexOf(req.path);
    const _middle   = 'middle.user.enabled';
    
    // yukarıdaki path'ler için user data kontrol etmiyoruz
    if( pIndex === -1 && ! _userData ) {
        return _helper.middle(next, _middle, 'not found user data');
    } else if(_userData && _userData.is_enabled === 'No') {
        return _helper.middle(next, _middle, 'not enabled user');
    }

    next();
};

exports.found = (req, res, next) => {
    const _helper = req.app.lib.utils.helper;
    const _schema = req.app.lib.schema;
    const _email  = req.body.email;
    const _middle = 'middle.user.found';
    
    if( ! _email || _email === '' ) {
        return _helper.middle(next, _middle, 'email not found');
    }
        
    const obj = {
        email: _email.toLowerCase(),
        qt: 'one',
    };

    new _schema('system.users').init(req, res, next).get(obj, (err, doc) => {
        if(doc) {
            return _helper.middle(next, _middle, 'user found');
        }
            
        next();
    });
};

exports.profile = (req, res, next) => {
    const _helper = req.app.lib.utils.helper;
    const _schema = req.app.lib.schema;
    const _middle = 'middle.user.profile';
    
    if( ! req.__user || ! req.__user.id ) {
        return _helper.middle(next, _middle, 'request user not found');
    }

    const _profiles = `${req.__appData.slug}.profiles`;
    const _model    = new _schema(_profiles).init(req, res, next);

    if( ! _model ) {
        return _helper.middle(next, _middle, 'profile model not found');
    }

    _model.get({users: req.__user.id, qt: 'one'}, (err, doc) => {
        if( err || ! doc ) {
            return _helper.middle(next, _middle, 'profile not found');
        }

        req.__profileData     = doc;
        req.__profileData._id = doc._id.toString();

        next();
    });
};

exports.waiting = (req, res, next) => {
    const _helper   = req.app.lib.utils.helper;
    const _schema   = req.app.lib.schema;
    const _userData = req.__userData;
    const paths     = ['/api/social', '/api/social/'];
    const pIndex    = paths.indexOf(req.path);
    const _middle   = 'middle.user.waiting';
    
    // yukarıdaki path'ler için user data kontrol etmiyoruz
    if( pIndex === -1 && ! _userData ) {
        return _helper.middle(next, _middle, 'not found user data');
    } else if(_userData && _userData.is_enabled === 'No' && _userData.waiting_status === 'Waiting') {
        return _helper.middle(next, _middle, 'you are in the waiting list');
    }

    next();
};
