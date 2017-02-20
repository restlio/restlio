module.exports = app => {
    const _mongoose = app.core.mongo.mongoose;

    const Schema = {
        refreshToken : {type: String, required: true, unique: true},
        clientId     : {type: String},
        userId       : {type: String, required: true},
        expires      : {type: Date},
    };

    const RefreshTokensSchema = app.core.mongo.db.Schema(Schema);

    // statics
    RefreshTokensSchema.method('getRefreshToken', (refreshToken, cb) => {
        const RefreshTokens = _mongoose.model('Oauth_RefreshTokens');

        RefreshTokens.findOne({refreshToken}, (err, token) => {
            // node-oauth2-server defaults to .user or { id: userId }, but { id: userId} doesn't work
            // This is in node-oauth2-server/lib/grant.js on line 256
            if (token) token.user = token.userId;
            cb(err, token);
        });
    });

    RefreshTokensSchema.method('saveRefreshToken', (token, clientId, expires, userId, cb) => {
        const RefreshTokens = _mongoose.model('Oauth_RefreshTokens');

        if (userId.id) userId = userId.id;

        const refreshToken = new RefreshTokens({
            refreshToken : token,
            clientId,
            userId,
            expires,
        });

        refreshToken.save(cb);
    });

    return _mongoose.model('Oauth_RefreshTokens', RefreshTokensSchema);
};
