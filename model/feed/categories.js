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
        ie : {type: String, default: 'Y', enum: ['Y', 'N'], alias: 'is_enabled'},
        ca : {type: Date, alias: 'created_at', default: Date.now}
    };


    /**
     * ----------------------------------------------------------------
     * Settings
     * ----------------------------------------------------------------
     */

    Schema.n.settings = {label: 'Name'};

    /**
     * ----------------------------------------------------------------
     * Load Schema
     * ----------------------------------------------------------------
     */

    const CategorySchema = app.libpost.model.loader.mongoose(Schema, {
        Name: 'Feed_Categories',
        Options: {
            singular : 'Feed Category',
            plural   : 'Feed Categories',
            columns  : ['name'],
            main     : 'name',
            perpage  : 25
        }
    });

    // plugins
    CategorySchema.plugin(_query);

    // compound index
    CategorySchema.index({ap: 1, n: 1}, {unique: true});

    /**
     * ----------------------------------------------------------------
     * Pre Save Hook
     * ----------------------------------------------------------------
     */

    CategorySchema.pre('save', next => {

        const self = this;
        self._isNew = self.isNew;
        next();

    });

    /**
     * ----------------------------------------------------------------
     * Post Save Hook
     * ----------------------------------------------------------------
     */

    CategorySchema.post('save', doc => {

        const self = this;
        if(self._isNew) {}

    });

    return _mongoose.model('Feed_Categories', CategorySchema);

};



