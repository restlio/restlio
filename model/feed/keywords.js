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
        t  : {type: String, required: true, alias: 'term'},
        f  : {type: Number, alias: 'freq'},
        co : {type: ObjectId, ref: 'Feed_Contents', alias: 'contents'},
        ci : {type: ObjectId, ref: 'Feed_Channels', alias: 'channels'},
        so : {type: ObjectId, ref: 'Feed_Sources', alias: 'sources'},
        ca : {type: Date, alias: 'created_at', default: Date.now}
    };

    /**
     * ----------------------------------------------------------------
     * Settings
     * ----------------------------------------------------------------
     */

    Schema.t.settings = {label: 'Term'};

    /**
     * ----------------------------------------------------------------
     * Load Schema
     * ----------------------------------------------------------------
     */

    const KeywordSchema = app.libpost.model.loader.mongoose(Schema, {
        Name: 'Feed_Keywords',
        Options: {
            singular : 'Feed Keyword',
            plural   : 'Feed Keywords',
            columns  : ['term'],
            main     : 'term',
            perpage  : 25
        }
    });

    // plugins
    KeywordSchema.plugin(_query);

    // compound index
    KeywordSchema.index({t: 1, co: 1}, {unique: true});

    /**
     * ----------------------------------------------------------------
     * Pre Save Hook
     * ----------------------------------------------------------------
     */

    KeywordSchema.pre('save', next => {

        const self = this;
        self._isNew = self.isNew;
        next();

    });

    /**
     * ----------------------------------------------------------------
     * Post Save Hook
     * ----------------------------------------------------------------
     */

    KeywordSchema.post('save', doc => {

        const self = this;
        if(self._isNew) {}

    });

    return _mongoose.model('Feed_Keywords', KeywordSchema);

};






