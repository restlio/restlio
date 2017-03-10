const _ = require('underscore');

module.exports = app => {
    const _env = app.get('env');
    const _mongoose = app.core.mongo.mongoose;
    const _query = app.lib.query;
    const _emitter = app.lib.schemaEmitter;

    // types
    const ObjectId = _mongoose.Schema.Types.ObjectId;
    const Mixed = _mongoose.Schema.Types.Mixed;

    /**
     * ----------------------------------------------------------------
     * Schema
     * ----------------------------------------------------------------
     */

    const Schema = {
        u  : {type: ObjectId, ref: 'System_Users', alias: 'users'},
        ur : {type: String, alias: 'users_role'},
        l  : {type: String, alias: 'level'},
        n  : {type: String, alias: 'namestr'}, // api
        c  : {type: String, alias: 'code'}, // api
        m  : {type: Mixed, alias: 'message'},
        md : {type: String, alias: 'middleware'}, // api
        e  : [{type: Mixed, alias: 'errors'}], // api
        t  : {type: String, alias: 'type'}, // api
        s  : {type: String, alias: 'source'},
        sl : {type: String, alias: 'slug'},
        p  : {type: String, alias: 'path'},
        ca : {type: Date, default: Date.now, alias: 'created_at'},
        st : {type: String, alias: 'stackstr'},
    };

    /**
     * ----------------------------------------------------------------
     * Settings
     * ----------------------------------------------------------------
     */

    Schema.l.settings = {label: 'Level'};
    Schema.n.settings = {label: 'Name'};
    Schema.c.settings = {label: 'Code'};
    Schema.t.settings = {label: 'Type'};
    Schema.s.settings = {label: 'Source'};
    Schema.m.settings = {label: 'Message'};
    Schema.st.settings = {label: 'Stack'};

    /**
     * ----------------------------------------------------------------
     * Load Schema
     * ----------------------------------------------------------------
     */

    const LogSchema = app.libpost.model.loader.mongoose(Schema, {
        Name: 'System_Logs',
        Options: {
            singular : 'System Log',
            plural   : 'System Logs',
            columns  : ['level', 'namestr', 'code', 'type', 'source', 'message', 'stackstr'],
            main     : 'level',
            perpage  : 25,
            nocreate : true,
            nodelete : true,
            noedit   : true,
        },
        /*
        Alias: {
            meta: 'meta',
        },
        */
    });

    // plugins
    LogSchema.plugin(_query);

    // compound index
    LogSchema.index({u: 1});

    /**
     * ----------------------------------------------------------------
     * Pre Save Hook
     * ----------------------------------------------------------------
     */

    LogSchema.pre('save', function(next) {
        const self = this;
        self._isNew = self.isNew;
        next();
    });

    /**
     * ----------------------------------------------------------------
     * Post Save Hook
     * ----------------------------------------------------------------
     */

    LogSchema.post('save', function(doc) {
        const self = this;
        if(self._isNew) {}
    });

    return _mongoose.model('System_Logs', LogSchema);
};
