const async = require('async');
const dot   = require('dotty');
const _     = require('underscore');

_.mixin(require('safe-obj'));

// speed up calls
const hasOwn = Object.prototype.hasOwnProperty;

class Form {

    constructor(name, options) {
        this._name    = name;  // form name
        this._data    = false; // form data
        this._error   = false; // form errors
        this._props   = false; // save properties
        this._fields  = false; // form fields
        this._options = options || {}; // form options
        this._prefix  = '';    // form field ajax prefix
        this._cb      = false; // callback
        this._parent  = {};
        this._objId   = ''; // use for array of objects
        
        return this;
    }

    init(...args) {
        // app
        this._req  = args[0];
        this._app  = this._req.app;
        this._res  = args[1];
        this._next = args[2];

        // base model
        this._model = this.getModel(this._name);

        if( ! this._model )
            return this;

        // schema
        this._alias  = this._model.schema.inspector.Alias;
        this._save   = this._model.schema.inspector.Save;
        this._update = this._model.schema.inspector.Update;
        this._refs   = this._model.schema.inspector.Refs;

        // fields for array of objects
        if(this._options.object) {
            const field  = this._alias[this._options.object];
            this._props  = this._save.properties[field].items.properties;
            this._fields = Object.keys(this._props);
            this._parent = {
                index : this._options.index,
                key   : this._options.object,
                field   
            }; 
            
            // set form data
            if(this._options.data)
                this._data = this._options.data;
        }
        else {
            // set default fields
            this._props  = this._save.properties;
            this._fields = Object.keys(this._props);        
        }

        // console.log(this._props);
        // console.log(this._fields);
        
        return this;
    }

    type(value) {
        return Object.prototype.toString.call(value);
    }

    getModel(name) {
        name = name.toLowerCase();
        name = name.replace('_', '.');
        return dot.get(this._app.model, name);
    }

    data(data) {
        // form data'sına geçirirken lean bile olsa object id'ler nesne olarak gidiyor, clone'lamamız lazım
        this._data = JSON.parse(JSON.stringify(data));
        
        if(this._data._id)
            this._objId = this._data._id;
        
        return this;
    }

    error(error) {
        this._error = error;
        return this;
    }

    // object url prefix for field requests
    prefix(prefix) {
        this._prefix = prefix;
        return this;
    }

    render(fields, cb) {
        try {
            if( ! this._model || ! cb )
                return cb(true);

            fields     = fields || this._fields;
            this._cb   = cb;
            const self = this;
            const f    = {};

            if(this.type(fields) != '[object Array]')
                return cb(true);

            _.each(fields, (field, key) => {
                field = self._alias[field] ? self._alias[field] : field;

                if( ! self._props[field] )
                    return;

                // check field initial status
                const initial = dot.get(self._props[field], 'settings.initial');

                if( self.type(initial) == '[object Boolean]' && ! initial )
                    return;

                f[field] = self._props[field];
                f[field].prefix = self._prefix;
            });

            if(Object.keys(f).length)
                return this.fields(f);

            cb(true);
        }
        catch(e) {
            console.log(e);
        }
    }

    fields(fields) {
        const self = this;
        let a      = {};

        // ftype: field type
        let ftype;
        let tpl;
        let ref;

        _.each(fields, (field, key) => {
            ftype = dot.get(field, 'settings.field') || field.type;
            ftype = ftype.toLowerCase();

            let nested = false;
            if(field.ref) {
                ref    = self.getModel(field.ref);
                nested = ref.schema.inspector.Options.nested;
            }

            if(field.ftype == 'arrayOfObjects')
                tpl = 'arrayOfObjects';
            else if(nested)
                tpl = 'nested';
            else if(ftype == 'image')
                tpl = 'image';
            else if(field.ref)
                tpl = 'relation';
            // eq tanımlı alanlar için selectbox kullanıyoruz,
            // multiple alıp almayacağına (type=array ise) template'de karar veriyor
            else if(self.type(field.eq) == '[object Array]')
                tpl = 'select';
            else if(ftype == 'string')
                tpl = 'text';
            else if(ftype == 'textarea')
                tpl = 'textarea';
            else if(ftype == 'richtext')
                tpl = 'richtext';
            else if(ftype == 'boolean')
                tpl = 'checkbox';
            else if(ftype == 'number')
                tpl = 'number';
            else if(ftype == 'date')
                tpl = 'date';
            else if(ftype == 'datetime')
                tpl = 'datetime';
            else if(ftype == 'array')
                tpl = 'array';
            else
                tpl = 'text';

            (((a, tpl, field, key, self) => {
                a[key] = cb => {
                    let obj = {
                        name   : self._name,
                        key,
                        field,
                        data   : self._data[key] || false,
                        opts   : self._options,
                        parent : self._parent,
                        objId  : self._objId
                    };

                    if(field.ref)
                        obj.ref = self.getModel(field.ref);

                    if(self._req && self._req.session && self._req.session.time)
                        obj.time = self._req.session.time;
                            
                    // uses express render
                    new self._app.lib.field(self._app, tpl, obj, cb);

                    obj = null;
                };
            }))(a, tpl, field, key, self);

            ftype = nested = ref = tpl = null;
        });

        let keys = Object.keys(a);

        async.parallel(a, (err, results) => {
            if(err)
                console.log(err);

            let output = '';

            // parallel çalıştığı için key sırasına göre sıralama değişmeden output üretmemiz lazım
            // direkt async result'ını join edemeyiz
            if(results) {
                _.each(keys, (key, index) => {
                    if(results[key])
                        output += results[key];
                });
            }

            self._cb(err, output);
            keys = a = output = null;
        });
    }

}

module.exports = app => Form;
