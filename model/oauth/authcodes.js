module.exports = app => {
    const _env = app.get('env');
    const _mongoose = app.core.mongo.mongoose;
    const helper = app.lib.utils.helper;

    const Schema = {
        authCode : {type: String, required: true, unique: true, alias: 'authCode'},
        clientId : {type: String, alias: 'clientId'},
        userId   : {type: String, required: true, alias: 'userId'},
        expires  : {type: Date, alias: 'expires'},
    };

    const AuthCodesSchema = app.core.mongo.db.Schema(Schema);

    // statics
    AuthCodesSchema.method('getAuthCode', (authCode, cb) => {
        const AuthCodes = _mongoose.model('Oauth_AuthCodes');
        AuthCodes.findOne({authCode}, cb);
    });

    AuthCodesSchema.method('saveAuthCode', (code, clientId, expires, userId, cb) => {
        const AuthCodes = _mongoose.model('Oauth_AuthCodes');

        if (userId.id) userId = userId.id;

        const fields = {
            clientId,
            userId,
            expires,
        };

        AuthCodes.update({authCode: code}, fields, {upsert: true}, err => {
            if (err) {
                helper.log('error', err);
            }
            cb(err);
        });
    });

    return _mongoose.model('Oauth_AuthCodes', AuthCodesSchema);
};
