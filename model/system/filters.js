const php = require('phpjs');
const _   = require('underscore');

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
        u  : {type: ObjectId, required: true, ref: 'System_Users', alias: 'users'},
        n  : {type: String, required: true, alias: 'name'},
        o  : {type: String, required: true, alias: 'object'},
        f  : {type: String, required: true, alias: 'filter'}
    };

    /**
     * ----------------------------------------------------------------
     * Settings
     * ----------------------------------------------------------------
     */

    Schema.n.settings = {label: 'Name'};
    Schema.o.settings = {label: 'Object'};
    Schema.f.settings = {label: 'Filter'};

    /**
     * ----------------------------------------------------------------
     * Load Schema
     * ----------------------------------------------------------------
     */

    const FilterSchema = app.libpost.model.loader.mongoose(Schema, {
        Name: 'System_Filters',
        Options: {
            singular : 'System Filter',
            plural   : 'System Filters',
            columns  : ['name', 'object'],
            main     : 'name',
            perpage  : 25
        }
    });

    // plugins
    FilterSchema.plugin(_query);

    /**
     * ----------------------------------------------------------------
     * Pre Save Hook
     * ----------------------------------------------------------------
     */

    FilterSchema.pre('save', next => {

        const self    = this;
        self._isNew = self.isNew;
        next();

    });

    /**
     * ----------------------------------------------------------------
     * Post Save Hook
     * ----------------------------------------------------------------
     */

    FilterSchema.post('save', doc => {

        const self = this;
        if(self._isNew) {}

    });

    return _mongoose.model('System_Filters', FilterSchema);

};



