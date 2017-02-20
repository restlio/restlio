const oauthserver = require('oauth2-server');
const jwt         = require('jwt-simple');
const _           = require('underscore');

function _guest(req, res, next) {
    req.__user = {id: 'guest'};
    next();
}

function _accessToken(req, res, next) {
    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _conf   = _app.config[_env].api; // api config
    const _middle = 'middle.auth';
    
    try {
        // TODO: querystring ile de çalışabilsin
        const decoded = jwt.decode(req.headers['x-access-token'], _conf.token.secret);

        if ( decoded.exp <= Date.now() ) {
            return next( _resp.Unauthorized({
                middleware: _middle,
                type: 'TokenExpired',
            }) );
        }

        if(decoded.user) {
            req.__user = {id: decoded.user._id};

            if(decoded.user.profile) {
                req.__user.profile = decoded.user.profile;
            }
        }

        next();
    } catch(e) {
        return next( _resp.Unauthorized({
            middleware: _middle,
            type: 'TokenVerification',
            errors: ['token verification failed'],
        }));
    }
}

function Auth(req, res, next) {
    const _app = req.app;

    // method override olduğu durumda post parametrelerini get parametrelerine dönüştür
    if(req.headers['x-http-method-override'] === 'GET') {
        // TODO:
        // bu işlem post route için yapılacak, kontrol et
        // req.body req.query'ye merge edilebilir
        req.query = _.clone(req.body);
        delete req.body.access_token;
    }

    // guest user
    if( ! req.query.access_token && ! req.headers['x-access-token']) {
        _guest(req, res, next);
    } else if(req.query.access_token && _app.oauth) { // oauth user
        _app.oauth.authorise()(req, res, next);
    } else if(req.headers['x-access-token']) { // auth user
        // TODO: querystring ile de çalışabilsin
        _accessToken(req, res, next);
    } else {
        _guest(req, res, next);
    }
}

module.exports = app => {
    const _env  = app.get('env');
    const _conf = app.config[_env].api;
    app.oauth = false;

    if(_conf.oauth) {
        app.oauth = oauthserver({
            model: {
                getAuthCode      : app.model.oauthauthcodes.schema.methods.getAuthCode,
                saveAuthCode     : app.model.oauthauthcodes.schema.methods.saveAuthCode,
                getAccessToken   : app.model.oauthaccesstokens.schema.methods.getAccessToken,
                saveAccessToken  : app.model.oauthaccesstokens.schema.methods.saveAccessToken,
                saveRefreshToken : app.model.oauthrefreshtokens.schema.methods.saveRefreshToken,
                getRefreshToken  : app.model.oauthrefreshtokens.schema.methods.getRefreshToken,
                getClient        : app.model.oauthclients.schema.methods.getClient,
                grantTypeAllowed : app.model.oauthclients.schema.methods.grantTypeAllowed,
            },
            grants : ['authorization_code'],
            debug  : (_env !== 'production'),
            accessTokenLifetime: _conf.token.expires * 86400, // expires gün olarak tanımlanıyor
        });
    }

    return Auth;
};
