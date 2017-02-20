exports.detail = (req, res, next) => {
    const _helper = req.app.lib.utils.helper;
    const _middle = 'middle.check.body.detail';
    
    if( ! req.body.detail || req.body.detail === '' ) {
        return _helper.middle(next, _middle, 'detail not found');
    }

    next();
};

exports.email = (req, res, next) => {
    const _helper = req.app.lib.utils.helper;
    const _email  = req.body.email;
    const _middle = 'middle.check.body.email';
    
    if( ! _email || _email === '' ) {
        return _helper.middle(next, _middle, 'email not found');
    }

    req.body.email = _email.toLowerCase();
    next();
};

exports.password = (req, res, next) => {
    const _helper = req.app.lib.utils.helper;
    const _middle = 'middle.check.body.password';
    
    if( ! req.body.password || req.body.password === '' ) {
        return _helper.middle(next, _middle, 'password not found');
    }

    next();
};

exports.userid = (req, res, next) => {
    const _helper = req.app.lib.utils.helper;
    const _middle = 'middle.check.body.userid';
    
    if( ! req.body.user_id || req.body.user_id === '' ) {
        return _helper.middle(next, _middle, 'user id not found');
    }

    next();
};
