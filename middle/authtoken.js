function AuthToken(req, res, next) {
    const _helper = req.app.lib.utils.helper;
    const _token  = req.headers['x-access-token'];
    const _middle = 'middle.authtoken';
    
    if( ! _token || _token === '' ) {
        return _helper.middle(next, _middle, 'access token not found');
    }

    next();
}

module.exports = () => AuthToken;
