const async = require('async');
const _ = require('underscore');
const debug = require('debug')('RESTLIO:LIB:USER');

class User {

    constructor(app) {
        this._app = app;
        this._mongoose = app.core.mongo.mongoose;
        this.helper = app.lib.utils.helper;
        
        return this;
    }

    addRole(user) {
        if ( ! this._app.acl || ! user.ro.length ) {
            return debug('[ADD ROLE] app acl or user roles not found');
        }

        const Apps = this._mongoose.model('System_Apps');
        const Roles = this._mongoose.model('System_Roles');
        const self = this;

        const a = {
            roles(cb) {
                // rolleri alırken superadmin olmayanlar için işlem yapacağız
                Roles.find({_id: {$in: user.ro}, s: {$ne: 'superadmin'}}).exec((err, roles) => {
                    cb(err, roles);
                });
            },
        };

        async.parallel(a, (err, results) => {
            if(err) {
                return self.helper.log('error', err);
            }

            if( ! results || ! results.roles || ! results.roles.length ) {
                return debug('[ADD ROLE] roles not found');
            }

            const roleData = results.roles;

            // collect app ids from role data
            const apps = [];
            _.each(roleData, (value) => {
                apps.push(value.ap.toString());
            });

            // get apps data
            Apps.find({_id: {$in: apps}}).exec((err, apps) => {
                if( err || ! apps ) {
                    return debug('[ADD ROLE] apps not found');
                }

                // use apps _id as key
                const appsObj = {};
                apps.forEach(doc => {
                    appsObj[doc._id.toString()] = doc;
                });

                // acl'e parametre olarak role id yerine role slug vereceğiz
                // (node_acl'den sorgularken anlamlı olması için)
                const rolesObj = {};

                // use roles _id as key, appSlug_roleSlug as value
                _.each(roleData, (value) => {
                    rolesObj[value._id.toString()] = `${appsObj[value.ap.toString()].s}_${value.s}`;
                });

                const _roleName = (obj, rolesObj) => _.map(obj, key => rolesObj[key]);

                // yeni kayıt durumunda rolleri ekliyoruz
                user.ro = _roleName(user.ro, rolesObj);

                if(user.ro) {
                    self._app.acl.addUserRoles(user._id.toString(), user.ro);
                    return debug(`[ACL ADD USER ROLES] new user acl roles: ${user.ro}`);
                }
            });
        });
    }

}

module.exports = () => User;
