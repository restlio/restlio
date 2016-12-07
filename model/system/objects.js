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

    const ObjectSchema = app.libpost.model.loader.mongoose(Schema, {
        Name: 'System_Objects',
        Options: {
            singular : 'System Object',
            plural   : 'System Objects',
            columns  : ['name', 'slug'],
            main     : 'name',
            perpage  : 25,
            nocreate : true,
            nodelete : true,
            noedit   : true
        }
    });

    // plugins
    ObjectSchema.plugin(_query);

    // compound index
    ObjectSchema.index({ap: 1, n: 1}, {unique: true});
    ObjectSchema.index({ap: 1, s: 1}, {unique: true});

    /**
     * ----------------------------------------------------------------
     * Pre Save Hook
     * ----------------------------------------------------------------
     */

    ObjectSchema.pre('save', function(next) {

        const self = this;
        self._isNew = self.isNew;
        next();

    });

    /**
     * ----------------------------------------------------------------
     * Post Save Hook
     * ----------------------------------------------------------------
     */

    ObjectSchema.post('save', function(doc) {

        const self = this;
        if(self._isNew) {}

    });

    return _mongoose.model('System_Objects', ObjectSchema);

};



