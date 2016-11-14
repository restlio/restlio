module.exports = app => {

    const _env      = app.get('env');
    const _log      = app.lib.logger;
    const _mongoose = app.core.mongo.mongoose;
    const _group    = 'MODEL:oauth.accesstokens';

    const Schema = {
        accessToken : {type: String, required: true, unique: true, alias: 'accessToken'},
        clientId    : {type: String, alias: 'clientId'},
        userId      : {type: String, required: true, alias: 'userId'},
        expires     : {type: Date, alias: 'expires'}
    };

    const AccessTokensSchema = app.core.mongo.db.Schema(Schema);

    // statics
    AccessTokensSchema.method('getAccessToken', (bearerToken, cb) => {
        const AccessTokens = _mongoose.model('Oauth_AccessTokens');
        AccessTokens.findOne({accessToken: bearerToken}, cb);
    });

    AccessTokensSchema.method('saveAccessToken', (token, clientId, expires, userId, cb) => {
        const AccessTokens = _mongoose.model('Oauth_AccessTokens');

        if (userId.id)
            userId = userId.id;

        const fields = {
            clientId,
            userId,
            expires
        };

        AccessTokens.update({accessToken: token}, fields, {upsert: true}, err => {
            if (err)
                _log.error(_group, err);

            cb(err);
        });
    });

    return _mongoose.model('Oauth_AccessTokens', AccessTokensSchema);

};