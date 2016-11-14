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
        r  : {type: ObjectId, required: true, ref: 'System_Rooms', alias: 'rooms'},
        d  : {type: String, required: true, alias: 'detail'},
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

    const MessageSchema = app.libpost.model.loader.mongoose(Schema, {
        Name: 'System_Messages',
        Options: {
            singular : 'System Message',
            plural   : 'System Messages',
            columns  : ['users'],
            main     : 'users',
            perpage  : 25
        }
    });

    // plugins
    MessageSchema.plugin(_query);

    /**
     * ----------------------------------------------------------------
     * Pre Save Hook
     * ----------------------------------------------------------------
     */

    MessageSchema.pre('save', next => {

        const self = this;
        self._isNew = self.isNew;
        next();

    });

    /**
     * ----------------------------------------------------------------
     * Post Save Hook
     * ----------------------------------------------------------------
     */

    MessageSchema.post('save', doc => {

        const self = this;
        if(self._isNew) {}

    });

    return _mongoose.model('System_Messages', MessageSchema);

};



