const async = require('async');
const autoBind = require('auto-bind');
const Base = require('../../../lib/schemaBase')();
const promisify = require('es6-promisify');

class SystemUsers extends Base {

    constructor(App) {
        super('system.users');
        this.App = App;
        this.getByEmailPr = promisify(this.getByEmail, this);
        this.init(this.App);
        autoBind(this);
    }

    getByEmail(email, cb) {
        email = email.toLowerCase();
        const obj = {email, qt: 'one'};
        this.get(obj, cb);
    }

}

module.exports = app => SystemUsers;
