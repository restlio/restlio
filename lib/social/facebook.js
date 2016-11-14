const Purest = require('purest');

class Facebook {

    constructor(opts) {
        this._opts = opts || {};
        this._opts.provider = 'facebook';
        this._purest = new Purest(this._opts);
        this._group = 'LIB:SOCIAL:FACEBOOK';

        return this;
    }

    user(cb) {
        const self = this;

        this._purest.query()
            .get('me')
            .auth(this._opts.auth.token)
            .request((err, res, body) => {
                if (err) {
                    console.log(err);
                    return cb(err);
                }

                cb(null, body);
            });
    }

    post(endpoint, form, cb) {
        // form = {message: 'post message'}

        this._purest.query()
            .post(endpoint || 'me/feed')
            .auth(this._opts.auth.token)
            .form(form)
            .request((err, res, body) => {
                if (err) {
                    console.log(err);
                    return cb(err);
                }

                cb(null, body);
            });
    }
    
}

module.exports = app => Facebook;

