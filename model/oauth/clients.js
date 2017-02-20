module.exports = app => {
    const _env      = app.get('env');
    const _log      = app.lib.logger;
    const _mongoose = app.core.mongo.mongoose;
    const _query    = app.lib.query;
    const _emitter  = app.lib.schemaEmitter;
    const _helper   = app.lib.utils.helper;
    const _group    = 'MODEL:oauth.clients';

    // types
    const ObjectId  = _mongoose.Schema.Types.ObjectId;
    const Mixed     = _mongoose.Schema.Types.Mixed;

    /**
     * ----------------------------------------------------------------
     * Schema
     * ----------------------------------------------------------------
     */

    const Schema = {
        name         : {type: String, unique: true, alias: 'name'},
        apps         : {type: ObjectId, required: true, ref: 'System_Apps', alias: 'apps'},
        clientId     : {type: String, unique: true, alias: 'clientId'},
        clientSecret : {type: String, index: true, alias: 'clientSecret'},
        redirectUri  : {type: String, required: true, alias: 'redirectUri', pattern: 'url'},
    };

    /**
     * ----------------------------------------------------------------
     * Settings
     * ----------------------------------------------------------------
     */

    Schema.name.settings         = {label: 'Name'};
    Schema.apps.settings         = {label: 'Apps', display: 'name'};
    Schema.clientId.settings     = {label: 'Client Id'};
    Schema.clientSecret.settings = {label: 'Client Secret'};
    Schema.redirectUri.settings  = {label: 'Redirect Uri'};

    /**
     * ----------------------------------------------------------------
     * Load Schema
     * ----------------------------------------------------------------
     */

    const ClientsSchema = app.libpost.model.loader.mongoose(Schema, {
        Name: 'Oauth_Clients',
        Options: {
            singular : 'Client',
            plural   : 'Clients',
            columns  : ['name', 'apps', 'redirectUri', 'clientId', 'clientSecret'],
            main     : 'name',
            perpage  : 25,
        },
    });

    // plugins
    ClientsSchema.plugin(_query);

    /**
     * ----------------------------------------------------------------
     * Pre Save Hook
     * ----------------------------------------------------------------
     */

    ClientsSchema.pre('save', function(next) {
        const self = this;

        if(self.isNew) {
            if( ! self.clientId ) {
                self.clientId = _helper.random(32);
            }

            if( ! self.clientSecret ) {
                self.clientSecret = _helper.random(32);
            }
        }

        next();
    });

    /**
     * ----------------------------------------------------------------
     * Post Save Hook
     * ----------------------------------------------------------------
     */

    ClientsSchema.post('save', function(doc) {
        const self = this;
        if(self._isNew) {}
    });

    /**
     * ----------------------------------------------------------------
     * Methods
     * ----------------------------------------------------------------
     */

    ClientsSchema.method('getClient', (clientId, clientSecret, cb) => {
        const Clients = _mongoose.model('Oauth_Clients');
        const params  = {clientId};

        if (clientSecret !== null) {
            params.clientSecret = clientSecret;
        }

        Clients.findOne(params, cb);
    });

    ClientsSchema.method('grantTypeAllowed', (clientId, grantType, cb) => {
        const Clients = _mongoose.model('Oauth_Clients');
        cb(false, true);
    });

    return _mongoose.model('Oauth_Clients', ClientsSchema);
};
