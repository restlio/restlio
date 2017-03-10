const async = require('async');
const php = require('phpjs');
const _ = require('underscore');
const debug = require('debug')('RESTLIO:MODEL:SYSTEM_ACTIONS');

module.exports = app => {
    const _env = app.get('env');
    const _mongoose = app.core.mongo.mongoose;
    const _query = app.lib.query;
    const _emitter = app.lib.schemaEmitter;
    const helper = app.lib.utils.helper;

    // types
    const ObjectId = _mongoose.Schema.Types.ObjectId;
    const Mixed = _mongoose.Schema.Types.Mixed;

    /**
     * ----------------------------------------------------------------
     * Schema
     * ----------------------------------------------------------------
     */

    const Schema = {
        ap  : {type: ObjectId, required: true, ref: 'System_Apps', alias: 'apps'},
        r   : {type: ObjectId, required: true, ref: 'System_Roles', alias: 'roles'},
        o   : {type: ObjectId, required: true, ref: 'System_Objects', alias: 'objects'},
        a   : [{type: String, required: true, enum: ['get', 'post', 'put', 'delete'], alias: 'action'}],
        m   : [{type: String, enum: ['get*', 'post*', 'put*', 'delete*'], alias: 'master'}],
    };

    /**
     * ----------------------------------------------------------------
     * Settings
     * ----------------------------------------------------------------
     */

    Schema.r.settings = {label: 'Role', display: 'name'};
    Schema.o.settings = {label: 'Object', display: 'name'};

    Schema.a[0].settings = {
        label: 'Action',
        options: [
            {label: 'Get', value: 'get'},
            {label: 'Post', value: 'post'},
            {label: 'Put', value: 'put'},
            {label: 'Delete', value: 'delete'},
        ],
    };

    Schema.m[0].settings = {
        label: 'Master',
        options: [
            {label: 'Get', value: 'get*'},
            {label: 'Post', value: 'post*'},
            {label: 'Put', value: 'put*'},
            {label: 'Delete', value: 'delete*'},
        ],
    };

    /**
     * ----------------------------------------------------------------
     * Load Schema
     * ----------------------------------------------------------------
     */

    const ActionSchema = app.libpost.model.loader.mongoose(Schema, {
        Name: 'System_Actions',
        Options: {
            singular : 'System Action',
            plural   : 'System Actions',
            columns  : ['roles', 'objects', 'action', 'master'],
            main     : 'action',
            perpage  : 25,
        },
    });

    // plugins
    ActionSchema.plugin(_query);

    // compound index
    ActionSchema.index({ap: 1, r: 1, o: 1}, {unique: true});

    /**
     * ----------------------------------------------------------------
     * Pre Save Hook
     * ----------------------------------------------------------------
     */

    ActionSchema.pre('save', function(next) {
        const self = this;
        self._isNew = self.isNew;
        next();
    });

    /**
     * ----------------------------------------------------------------
     * Post Save Hook
     * ----------------------------------------------------------------
     */

    ActionSchema.post('save', function(doc) {
        const self = this;
        doc = doc.toJSON();

        if(app.acl) {
            const Apps = _mongoose.model('System_Apps');
            const Roles = _mongoose.model('System_Roles');
            const Objects = _mongoose.model('System_Objects');

            const a = {};

            a.role = cb => {
                Roles.findById(doc.r, (err, role) => {
                    cb(err, role);
                });
            };

            a.object = cb => {
                Objects.findById(doc.o, (err, object) => {
                    cb(err, object);
                });
            };

            async.parallel(a, (err, results) => {
                if(err) {
                    return helper.log('error', err);
                }

                if( ! results || ! results.role || ! results.object ) {
                    return debug('role or object not found');
                }

                const role = results.role;
                const object = results.object;
                const roleApp = role.ap.toString();
                const objApp = object.ap.toString();

                // TODO:
                // system objelerine erişim izni gereken uygulamalarda bu kontrol izin vermiyor
                // (uygulama ile sistem ayrı application)

                // if(roleApp != objApp)
                //    return _log.info('app id is not same for role and object');

                Apps.findById(roleApp, (err, apps) => {
                    if( err || ! apps ) {
                        return debug('app not found');
                    }

                    const roleName = `${apps.s}_${role.s}`;
                    const objName = object.s.replace('.', '_');

                    if(self._isNew) {
                        app.acl.allow(roleName, objName, doc.a);

                        if(doc.m.length) {
                            app.acl.allow(roleName, objName, doc.m);
                            debug(`[ACL ALLOW] ${roleName}:${objName}:${doc.m}`);
                        }

                        return debug(`[ACL ALLOW] ${roleName}:${objName}:${doc.a}`);
                    }

                    // TODO:
                    // aşağıdaki actions ve master işlemlerinde _original data gerekiyor, yoksa işlem yapmıyoruz

                    if( ! self._original ) {
                        return debug('action original data not found !!!');
                    }

                    /**
                     * actions
                     */

                    const _original = self._original.a;
                    const _new = doc.a;

                    // new actions
                    let newActions = php.array_diff(_new, _original);
                    newActions = _.map(Object.keys(newActions), key => newActions[key]);

                    if(newActions.length) {
                        app.acl.allow(roleName, objName, newActions);
                        debug(`[ACL ALLOW] ${roleName}:${objName}:${newActions}`);
                    }

                    // old actions
                    let oldActions = php.array_diff(_original, _new);
                    oldActions = _.map(Object.keys(oldActions), key => oldActions[key]);

                    if(oldActions.length) {
                        app.acl.removeAllow(roleName, objName, oldActions);
                        debug(`[ACL REMOVE ALLOW] ${roleName}:${objName}:${oldActions}`);
                    }

                    /**
                     * master
                     */

                    const _orgm = self._original.m;
                    const _newm = doc.m;

                    // new actions
                    let newMaster = php.array_diff(_newm, _orgm);
                    newMaster = _.map(Object.keys(newMaster), key => newMaster[key]);

                    if(newMaster.length) {
                        app.acl.allow(roleName, objName, newMaster);
                        debug(`[ACL ALLOW] ${roleName}:${objName}:${newMaster}`);
                    }

                    // old actions
                    let oldMaster = php.array_diff(_orgm, _newm);
                    oldMaster = _.map(Object.keys(oldMaster), key => oldMaster[key]);

                    if(oldMaster.length) {
                        app.acl.removeAllow(roleName, objName, oldMaster);
                        debug(`[ACL REMOVE ALLOW] ${roleName}:${objName}:${oldMaster}`);
                    }
                });
            });
        }
    });

    /**
     * ----------------------------------------------------------------
     * Post Remove Hook
     * ----------------------------------------------------------------
     */

    ActionSchema.post('remove', function (doc) {
        const self = this;
        doc = doc.toJSON();

        if(app.acl) {
            const Apps = _mongoose.model('System_Apps');
            const Roles = _mongoose.model('System_Roles');
            const Objects = _mongoose.model('System_Objects');

            const a = {};

            a.role = cb => {
                Roles.findById(doc.r, (err, role) => {
                    cb(err, role);
                });
            };

            a.object = cb => {
                Objects.findById(doc.o, (err, object) => {
                    cb(err, object);
                });
            };

            async.parallel(a, (err, results) => {
                if(err) {
                    return helper.log('error', err);
                }

                if( ! results || ! results.role || ! results.object ) {
                    return debug('role or object not found');
                }

                const role = results.role;
                const object = results.object;
                const roleApp = role.ap.toString();
                const objApp = object.ap.toString();

                // TODO:
                // system objelerine erişim izni gereken uygulamalarda bu kontrol izin vermiyor
                // (uygulama ile sistem ayrı application)

                // if(roleApp != objApp)
                //    return _log.info('app id is not same for role and object');

                Apps.findById(roleApp, (err, apps) => {
                    if( err || ! apps ) {
                        return debug('app not found');
                    }

                    const roleName = `${apps.s}_${role.s}`;
                    const objName = object.s.replace('.', '_');

                    app.acl.removeAllow(roleName, objName, doc.a);
                    debug(`[ACL REMOVE ALLOW] ${roleName}:${objName}:${doc.a}`);

                    if(doc.m.length) {
                        app.acl.removeAllow(roleName, objName, doc.m);
                        debug(`[ACL REMOVE ALLOW] ${roleName}:${objName}:${doc.m}`);
                    }
                });
            });
        }
    });

    return _mongoose.model('System_Actions', ActionSchema);
};
