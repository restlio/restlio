const dot = require('dotty');

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
        n  : {type: String, required: true, alias: 'name'},
        s  : {type: String, alias: 'slug'},
        d  : {type: String, alias: 'detail'},
        rm : {type: String, required: true, alias: 'ref_model'},
        ri : {type: String, required: true, alias: 'ref_id'},
        au : [{type: ObjectId, required: true, ref: 'System_Users', alias: 'allowed_users'}],
        bu : [{type: ObjectId, ref: 'System_Users', alias: 'banned_users'}],
        u  : {type: ObjectId, ref: 'System_Users', alias: 'users'}, // room owner if necessary (unique index, sparse: true)
        ca : {type: Date, alias: 'created_at', default: Date.now}
    };

    /**
     * ----------------------------------------------------------------
     * Settings
     * ----------------------------------------------------------------
     */

    /**
     * ----------------------------------------------------------------
     * Load Schema
     * ----------------------------------------------------------------
     */

    const RoomSchema = app.libpost.model.loader.mongoose(Schema, {
        Name: 'System_Rooms',
        Options: {
            singular : 'System Room',
            plural   : 'System Rooms',
            columns  : ['users'],
            main     : 'users',
            perpage  : 25
        }
    });

    // plugins
    RoomSchema.plugin(_query);

    /**
     * ----------------------------------------------------------------
     * Pre Save Hook
     * ----------------------------------------------------------------
     */

    RoomSchema.pre('save', next => {

        const self = this;
        self._isNew = self.isNew;
        next();

    });

    /**
     * ----------------------------------------------------------------
     * Post Save Hook
     * ----------------------------------------------------------------
     */

    RoomSchema.post('save', doc => {

        const self = this;
        if(self._isNew) {}

    });

    return _mongoose.model('System_Rooms', RoomSchema);

};



