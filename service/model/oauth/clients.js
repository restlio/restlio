const async = require('async');
const autoBind = require('auto-bind');
const Base = require('../../../lib/schemaBase')();
const promisify = require('es6-promisify');

class OauthClients extends Base {

    constructor(App) {
        super('oauth.clients');
        this.App = App;
        this.getByIdAndSecretPromise = promisify(this.getByIdAndSecret, this);
        this.init(this.App);
        autoBind(this);
    }

    getByIdAndSecret(data, cb) {
        const {clientId, clientSecret} = data;
        const obj = {clientId, clientSecret, qt: 'one'};
        this.get(obj, (err, doc) => cb(null, doc));
    }

}

module.exports = app => OauthClients;
