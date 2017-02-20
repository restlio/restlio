const async = require('async');
const autoBind = require('auto-bind');
const Base = require('../../../lib/schemaBase')();
const promisify = require('es6-promisify');

class SystemApps extends Base {

    constructor(App) {
        super('system.apps');
        this.App = App;
        this.getBySlugPromise = promisify(this.getBySlug, this);
        this.init(this.App);
        autoBind(this);
    }

    getBySlug(slug, cb) {
        const obj = {slug, qt: 'one'};
        this.get(obj, (err, doc) => cb(null, doc));
    }

}

module.exports = app => SystemApps;
