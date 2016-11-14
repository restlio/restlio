const async = require('async');
const dot   = require('dotty');
const _     = require('underscore');

class User {

    constructor(app) {
        this._app = app;
        this._mongoose = app.core.mongo.mongoose;
        this._log = app.system.logger;

        return this;
    }

    addRole(user) {
        if ( ! this._app.acl || ! user.ro.length )
            return this._log.info('app acl or user roles not found (User.addRole)');

        const Apps  = this._mongoose.model('System_Apps');
        const Roles = this._mongoose.model('System_Roles');
        const self  = this;

        const a = {
            roles(cb) {
                // rolleri alırken superadmin olmayanlar için işlem yapacağız
                Roles.find({_id: {$in: user.ro}, s: {$ne: 'superadmin'}}).exec((err, roles) => {
                    cb(err, roles);
                });
            }
        };

        async.parallel(a, (err, results) => {
            if(err)
                return self._log.error(err);

            if( ! results || ! results.roles || ! results.roles.length )
                return self._log.info('roles not found (User.addRole)');

            const roleData = results.roles;

            // collect app ids from role data
            const apps = [];
            _.each(roleData, (value, key) => {
                apps.push(value.ap.toString());
            });

            // get apps data
            Apps.find({_id: {$in: apps}}).exec((err, apps) => {
                if( err || ! apps )
                    return self._log.info('apps not found (User.addRole)');

                // use apps _id as key
                const appsObj = {};
                apps.forEach(doc => {
                    appsObj[doc._id.toString()] = doc;
                });

                // acl'e parametre olarak role id yerine role slug vereceğiz
                // (node_acl'den sorgularken anlamlı olması için)
                const rolesObj = {};

                // use roles _id as key, appSlug_roleSlug as value
                _.each(roleData, (value, key) => {
                    rolesObj[value._id.toString()] = `${appsObj[value.ap.toString()].s}_${value.s}`;
                });

                const _role_name = (obj, rolesObj) => _.map(obj, key => rolesObj[key]);

                // yeni kayıt durumunda rolleri ekliyoruz
                user.ro = _role_name(user.ro, rolesObj);

                if(user.ro) {
                    self._app.acl.addUserRoles(user._id.toString(), user.ro);
                    return self._log.info(`[acl:addUserRoles] new user acl roles: ${user.ro}`);
                }
            });
        });
    }

}

module.exports = app => User;
