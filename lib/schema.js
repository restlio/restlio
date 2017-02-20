const debug = require('debug');
const dot = require('dotty');
const _ = require('underscore');

// speed up calls
const toString = Object.prototype.toString;

class Schema {
    
    constructor(name, options) {
        this._name = name;
        this._options = options || {};
        this._err = false;
        return this;
    }

    err() {
        this._err = true;
        return this;
    }

    init(...args) {
        // set arguments
        if(args.length === 3) { // req, res, next
            this._req = args[0];
            this._app = this._req.app;
            this._res = args[1];
            this._next = args[2];
        } else {
            this._app = args[0]; // app
        }

        // http responses
        this._http = this._app.system.response ? this._app.system.response.app : false;

        // base model
        this._model = this.getModel(this._name);

        // check model and get adapter
        // console.log(this._model.base.constructor.name);

        if( ! this._model ) {
            return this._err ? false : this.errors({name: 'SchemaError'});
        }

        // config
        this._env = this._app.get('env');
        this._config = this._app.config[this._env].api;
        this._log = this._app.lib.logger;

        // schema
        this._alias = this._model.schema.inspector.Alias;
        this._key2alias = this._model.schema.inspector.KeyAlias;
        this._save = this._model.schema.inspector.Save;
        this._update = this._model.schema.inspector.Update;
        this._refs = this._model.schema.inspector.Refs;
        this._schemaOpts = this._model.schema.inspector.Options;
        this._owner = this._model.schema.inspector.Owner;
        this._mask = this._model.schema.inspector.Mask;
        this._structure = this._model.schema.structure;
        this._master = this._req ? this._req.__master : undefined;
        this._time = this._req ? this._req.__time : false;
        this._emitter = this._app.lib.schemaEmitter;
        this._mongoose = this._app.core.mongo.mongoose;
        this._dismissHook = false;
        this._dateFormat = false;
        
        // is api call?
        this._api = (this._res && this._res.__api);

        // is user?
        this._user = (this._req && this._req.__user) ? this._req.__user.id : false;

        // is guest?
        this._guest = (this._user === 'guest');
        
        // has profile?
        this._profile = (this._req && this._req.__user) ? this._req.__user.profile : false;
        
        // has app id?
        this._appId = (this._req && this._req.__system_AppId) ? this._req.__system_AppId : false;
        
        // logger group
        this._group = `RESTLIO:SCHEMA:${this._name}`;
        if(this._api) this._group = `API:${this._group}`;
        if(this._user) this._group += `:USER:${this._user}`;

        // format output?
        this._format =
            (typeof this._options.format !== 'undefined') ?
                this._options.format :
                (this._req ? this.isTrue(this._req.query.format || true) : true);
        
        // set schema inspector methods
        this.inspect();
        this._sanitize = {
            html: this.sanitize_html,
        };
        this._validate = {
            empty: this.validate_empty,
            objectid: this.validate_objectid,
        };

        return this;
    }

    log(key, value) {
        debug(`${this._group}`)(`[${key}] %o`, value);
        // this._log.schema(`${this._group}:${key}`, value, this._api);
    }

    getModel(name) {
        name = name.toLowerCase();
        name = name.replace('_', '.');
        return dot.get(this._app.model, name);
    }

    type(value) {
        return toString.call(value);
    }

    isTrue(input) {
        if (typeof input === 'string') {
            return input.toLowerCase() === 'true';
        }

        return !!input;
    }

    format(value) {
        this._format = value;
        return this;
    }

    // TODO: hours ve minutes yoksa burada set et
    setTz(timezone) {
        this._dateFormat = true;
        this._time = {
            name: timezone,
        };

        return this;
    }

    dateFormat() {
        this._dateFormat = true;
        return this;
    }

    protect(type, owner) {
        const _owner = owner || this._owner;
        return (_owner && dot.get(_owner, `protect.${type}`) && this._api);
    }

    clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    header(header, obj) {
        if(this._api) this._res.setHeader(header, JSON.stringify(obj));
    }

    // model structure
    structure(cb) {
        if( ! this._structure ) {
            return cb ? cb({name: 'NotFound'}) : this.errors({name: 'NotFound'});
        }

        return cb ? cb(null, this._structure) : this._http.OK(this._structure, this._res);
    }

    // only parse query, don't execute
    parse(obj) {
        return this._model.parse(obj);
    }

    // execute "this.from" for doc array
    formatFrom(doc) {
        const self = this;
        _.each(doc, (value) => self.from(value));
    }

    dismissHook(status) {
        this._dismissHook = status;
        return this;
    }

}

Object.assign(Schema.prototype, require('./__schema/errors'));
Object.assign(Schema.prototype, require('./__schema/mask'));
Object.assign(Schema.prototype, require('./__schema/getFunc'));
Object.assign(Schema.prototype, require('./__schema/query'));

Object.assign(Schema.prototype, {
    inspect: require('./__schema/inspect'),
    get: require('./__schema/get'),
    getById: require('./__schema/getById'),
    post: require('./__schema/post'),
    put: require('./__schema/put'),
    remove: require('./__schema/remove'),
    to: require('./__schema/to'),
    from: require('./__schema/from'),
    validate: require('./__schema/validate'),
});

module.exports = () => Schema;
