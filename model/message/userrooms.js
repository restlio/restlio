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
        u  : {type: ObjectId, required: true, ref: 'System_Users', alias: 'users'},
        r  : {type: ObjectId, required: true, ref: 'System_Rooms', alias: 'rooms'}, // bazı field'ları denormalize et
        m  : {type: ObjectId, ref: 'System_Messages', alias: 'last_message'}, // bazı field'ları denormalize et
        rd : {type: Number, default: 0, alias: 'unread'},
        ua : {type: Date, alias: 'updated_at', default: Date.now},
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

    const UserRoomSchema = app.libpost.model.loader.mongoose(Schema, {
        Name: 'System_UserRooms',
        Options: {
            singular : 'System User Room',
            plural   : 'System User Rooms',
            columns  : ['users'],
            main     : 'users',
            perpage  : 25
        }
    });

    // plugins
    UserRoomSchema.plugin(_query);

    /**
     * ----------------------------------------------------------------
     * Pre Save Hook
     * ----------------------------------------------------------------
     */

    UserRoomSchema.pre('save', next => {

        const self = this;
        self._isNew = self.isNew;
        next();

    });

    /**
     * ----------------------------------------------------------------
     * Post Save Hook
     * ----------------------------------------------------------------
     */

    UserRoomSchema.post('save', doc => {

        const self = this;
        if(self._isNew) {}

    });

    return _mongoose.model('System_UserRooms', UserRoomSchema);

};



