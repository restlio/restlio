const extend = require('extend');
const dot    = require('dotty');

class Async {

    constructor(app) {
        this._app = app;
        this._env = app.get('env');
        this._log = app.lib.logger;

        return this;
    }

    aclResources(userId) {
        const self = this;

        return cb => {
            self._app.acl.userRoles(userId, (err, roles) => {
                self._app.acl.whatResources(roles, (err, resources) => {
                    cb(null, {roles, resources});
                });
            });
        };
    }
    
}

module.exports = app => new Async(app);
