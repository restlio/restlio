module.exports = app => {

    const _env      = app.get('env');
    const _log      = app.lib.logger;
    const _mongoose = app.core.mongo.mongoose;
    const _query    = app.lib.query;
    const _emitter  = app.lib.schemaEmitter;

    // types
    const ObjectId  = _mongoose.Schema.Types.ObjectId;
    const Mixed     = _mongoose.Schema.Types.Mixed;

    /**
     * ----------------------------------------------------------------
     * Schema
     * ----------------------------------------------------------------
     */

    const Schema = {
        ap : {type: ObjectId, required: true, ref: 'System_Apps', alias: 'apps'},
        n  : {type: String, required: true, alias: 'name'},
        s  : {type: String, required: true, alias: 'slug'}
    };

    /**
     * ----------------------------------------------------------------
     * Settings
     * ----------------------------------------------------------------
     */

    Schema.n.settings = {label: 'Name'};
    Schema.s.settings = {label: 'Slug'};

    /**
     * ----------------------------------------------------------------
     * Load Schema
     * ----------------------------------------------------------------
     */

    const RoleSchema = app.libpost.model.loader.mongoose(Schema, {
        Name: 'System_Roles',
        Options: {
            singular : 'System Role',
            plural   : 'System Roles',
            columns  : ['name', 'slug'],
            main     : 'name',
            perpage  : 25,
            nodelete : true
        }
    });

    // plugins
    RoleSchema.plugin(_query);

    // compound index
    RoleSchema.index({ap: 1, n: 1}, {unique: true});
    RoleSchema.index({ap: 1, s: 1}, {unique: true});

    /**
     * ----------------------------------------------------------------
     * Pre Save Hook
     * ----------------------------------------------------------------
     */

    RoleSchema.pre('save', next => {

        const self = this;
        self._isNew = self.isNew;
        next();

    });

    /**
     * ----------------------------------------------------------------
     * Post Save Hook
     * ----------------------------------------------------------------
     */

    RoleSchema.post('save', doc => {

        const self = this;
        if(self._isNew) {}

    });

    return _mongoose.model('System_Roles', RoleSchema);

};



