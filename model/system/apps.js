const _ = require('underscore');

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
        n : {type: String, required: true, alias: 'name', unique: true},
        s : {type: String, required: true, alias: 'slug', unique: true},
        l : {type: String, required: true, alias: 'long', unique: true}
    };

    /**
     * ----------------------------------------------------------------
     * Settings
     * ----------------------------------------------------------------
     */

    Schema.n.settings = {label: 'Name'};
    Schema.s.settings = {label: 'Slug'};
    Schema.l.settings = {label: 'Long Name'};

    /**
     * ----------------------------------------------------------------
     * Load Schema
     * ----------------------------------------------------------------
     */

    const AppsSchema = app.libpost.model.loader.mongoose(Schema, {
        Name: 'System_Apps',
        Options: {
            singular : 'System App',
            plural   : 'System Apps',
            columns  : ['name', 'slug', 'long'],
            main     : 'name',
            perpage  : 10
        }
    });

    // plugins
    AppsSchema.plugin(_query);

    /**
     * ----------------------------------------------------------------
     * Pre Save Hook
     * ----------------------------------------------------------------
     */

    AppsSchema.pre('save', function(next) {

        const self    = this;
        self._isNew = self.isNew;
        next();

    });

    /**
     * ----------------------------------------------------------------
     * Post Save Hook
     * ----------------------------------------------------------------
     */

    AppsSchema.post('save', function(doc) {

        const self = this;
        if(self._isNew) {}

    });

    return _mongoose.model('System_Apps', AppsSchema);

};



