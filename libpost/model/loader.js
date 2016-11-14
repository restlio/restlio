const extend = require('extend');
const dot    = require('dotty');
const _      = require('underscore');

class LibpostModelLoader {

    constructor(app) {
        const self  = this;
        const group = 'MODEL:LOADER';
        
        try {
            this._app = app;
            this._env = app.get('env');
            this._log = app.lib.logger;
            this._inspector = app.lib.inspector;
            this._mongo = app.core.mongo;
            this._mongoose = app.core.mongo.mongoose;
            this._worker = parseInt(process.env.worker_id);
            this._syncConf = app.config[this._env].sync;
            this._emitter = app.lib.schemaEmitter;
            this._denormalize = app.lib.denormalize;
        }
        catch(e) {
            self._log.error(group, e.stack);
        }
        
        return this;
    }

    mongoose(schema, options) {
        const self  = this;
        const name  = options.Name;
        const lower = name.toLowerCase();
        const group = `MODEL:${name}`;
        
        try {
            // create schema
            const Schema = this._mongo.db.Schema(schema);

            let alias = {};
            if(options.ArrayOfObjects)
                alias = options.ArrayOfObjects;
            
            // create inspector
            const Inspector  = new this._inspector(schema, alias).init();
            Schema.inspector = Inspector;
            // Schema.structure = schema;

            // extend inspector with options
            extend(Schema.inspector, options);

            // allow superadmin (mongoose connection bekliyor)
            if(this._worker === 0 && dot.get(this._syncConf, 'data.superacl')) {
                this._mongoose.connection.on('open', () => {
                    if(self._app.acl) {
                        self._app.acl.allow('superadmin', lower, '*');
                        self._log.info(`${group}:ACL:ALLOW`, `superadmin:${lower}:*`, 'gray');
                    }
                });
            }

            // model denormalize sync 
            if(this._worker === 0 && dot.get(this._syncConf, `denormalize.${lower}`)) {
                setTimeout(() => {
                    self._app.lib.denormalize.sync(name, self._app.boot.kue);
                }, 10000);
            }

            // init post hooks and listeners
            this.postHooks(Schema, name);
            this.listener(options, Schema.inspector);
            
            return Schema;        
        }
        catch(e) {
            self._log.error(group, e.stack);
        }
    }

    /**
     * ----------------------------------------------------------------
     * Model Post Hooks
     * ----------------------------------------------------------------
     */

    postHooks(schema, name) {
        const self  = this;
        const lower = name.toLowerCase();
        
        // System_Users için işlem yapma 
        // (app.io modellerinden sadece users modeli event çalıştırıyor, kontrolünü kendi üzerinde sağlıyor)
        if(name == 'System_Users')
            return false;

        // pre save hook
        schema.pre('save', function (next) {
            const self       = this;
            self._isNew      = self.isNew;
            self._isModified = {};
            
            // set _isModified object values
            _.each(self._doc, (val, key) => {
                self._isModified[key] = self.isModified(key);
            });

            next();
        });
        
        // post save hook
        schema.post('save', function (doc) {
            if(this._isNew)
                self._emitter.emit(`${lower}_model_saved`, {source: name, doc});
            else
                self._emitter.emit(`${lower}_model_updated`, {source: name, doc});
        });

        // post remove hook
        schema.post('remove', doc => {
            self._emitter.emit(`${lower}_model_removed`, {source: name, doc});
        });    
    }

    /**
     * ----------------------------------------------------------------
     * Model Event Listeners
     * ----------------------------------------------------------------
     */

    listener(options, inspector) {
        const self         = this;
        const Name         = options.Name;
        const Denorm       = options.Denorm;
        const EntityDenorm = options.EntityDenorm;
        const Size         = options.Size; 
        const Count        = options.Count;
        const CountRef     = options.CountRef;
        const Hook         = options.Hook;
        
        if(Denorm) {
            _.each(Denorm, (value, key) => {
                self.denorm(`${key.toLowerCase()}_model_updated`, inspector);
            });
        }

        if(Denorm && EntityDenorm) { // denormalize edilmesi gereken modelin entity addtoset durumunda çalıştırılması gerekiyor
            _.each(EntityDenorm, value => {
                self.entityDenorm(Name, `${Name.toLowerCase()}_${value}_addtoset`);
            });
        }
        
        if(Size) {
            // post hook'ta çalışacak size'ların bir kere çalışması yeterli
            self.sizePostHook(Name, inspector);
            
            // entity api endpoint'leri için çalışacak event'ler
            _.each(Size, (target, source) => {
                self.size(Name, source, target, inspector);
            });        
        }

        if(Count) {
            _.each(Count, (target, source) => {
                self.count(Name, target, source, inspector);
            });
        }

        if(CountRef) {
            _.each(CountRef, (target, source) => {
                self.countRef(Name, target, source, inspector);
            });
        }

        if(Hook) {
            _.each(Hook, (hookData, action) => {
                _.each(hookData, (target, source) => {
                    self[`hook_${action}`](Name, source, target, inspector); 
                });
            });
        }
    }

    /**
     * ----------------------------------------------------------------
     * Model.Denorm
     * ----------------------------------------------------------------
     */

    denorm(listener, inspector) {
        const self = this;

        this._emitter.on(listener, data => {
            // _dismissHook değişkeni geldiğinde denormalization güncellemesi çalıştırılmayacak
            if(data.doc.__dismissHook)
                return false;
            
            self._log.info(`MODEL:LOADER:DENORM:${listener}`, data);
            self._app.lib.denormalize.touch(data, inspector);
        });
    }

    /**
     * ----------------------------------------------------------------
     * Model.EntityDenorm
     * ----------------------------------------------------------------
     */

    entityDenorm(name, listener) {
        const self = this;

        this._emitter.on(listener, data => {
            const id = data.id;
            
            if( ! id )
                return false;
            
            const Model = self._mongoose.model(name);
         
            Model.findById(id, (err, doc) => {
                if( err || ! doc )
                    return false;

                // denormalize document
                doc.save(err => {});
            });
        });
    }

    /**
     * ----------------------------------------------------------------
     * Model.Size
     * ----------------------------------------------------------------
     */

    // post hook'ta çalışacak size'ların bir kere çalışması yeterli
    sizePostHook(name, inspector) {
        const self  = this;
        const lower = name.toLowerCase();

        // Model post hook events
        this._emitter.on(`${lower}_model_saved`, data => {
            self._denormalize.size(data, inspector);
        });

        this._emitter.on(`${lower}_model_updated`, data => {
            self._denormalize.size(data, inspector);
        });
    }

    size(name, source, target, inspector) {
        const self  = this;
        const lower = name.toLowerCase();

        // Entity api events
        this._emitter.on(`${lower}_${source}_addtoset`, data => {
            self._incr(name, target, data.id);
        });
        
        this._emitter.on(`${lower}_${source}_pull`, data => {
            self._decr(name, target, data.id);
        });
    }

    /**
     * ----------------------------------------------------------------
     * Model.Count
     * ----------------------------------------------------------------
     */

    count(name, target, source, inspector) {
        const self  = this;
        const lower = name.toLowerCase();
        const Save  = inspector.Save.properties;
        const Alias = inspector.Alias;
        const ref   = dot.get(Save, `${Alias[source]}.ref`);

        if( ! ref )
            return this._log.error('LIBPOST:MODEL:LOADER:COUNT', 'reference not found');

        // Model post hook events 
        // (eğer post mask'e izin verilip kaydedilen field varsa ilk kaydedişte target'i güncelliyoruz)
        // (_model_updated için çalışmayacak)
        this._emitter.on(`${lower}_model_saved`, data => {
            const doc = data.doc;
            self._incr(ref, target, doc[Alias[source]]);
        });

        this._emitter.on(`${lower}_model_removed`, data => {
            const doc = data.doc;
            self._decr(ref, target, doc[Alias[source]]);
        });
        
        // Entity api events
        this._emitter.on(`${lower}_${source}_addtoset`, data => {
            self._incr(ref, target, data.value);
        });

        this._emitter.on(`${lower}_${source}_pull`, data => {
            self._decr(ref, target, data.value);
        });
    }

    /**
     * ----------------------------------------------------------------
     * Model.CountRef
     * ----------------------------------------------------------------
     */

    countRef(name, target, source, inspector) {
        const self  = this;
        const lower = name.toLowerCase();
        const Save  = inspector.Save.properties;
        const Alias = inspector.Alias;
        const ref   = dot.get(Save, `${Alias[source]}.ref`);

        if( ! ref )
            return this._log.error('LIBPOST:MODEL:LOADER:COUNT_REF', 'reference not found');

        /**
         * reference count şimdilik daha sonra update edilebilecek (_model_updated) durumlar için çalışmıyor
         */
        
        // Model post hook events
        this._emitter.on(`${lower}_model_saved`, data => {
            const doc = data.doc;
            self._incr(ref, target, doc[Alias[source]]);
        });

        this._emitter.on(`${lower}_model_removed`, data => {
            const doc = data.doc;
            self._decr(ref, target, doc[Alias[source]]);
        });
    }

    /**
     * ----------------------------------------------------------------
     * Model.Hook (push)
     * ----------------------------------------------------------------
     */

    hook_push(name, source, target, inspector) {
        const self  = this;
        const lower = name.toLowerCase();
        const Save  = inspector.Save.properties;
        const Alias = inspector.Alias;
        target      = target.split(':');
        const ref   = dot.get(Save, `${Alias[target[0]]}.ref`);

        if( ! ref )
            return this._log.error('LIBPOST:MODEL:LOADER:HOOK_PUSH', 'reference not found');

        // reference model
        const Model      = this._mongoose.model(ref);
        const ModelAlias = dot.get(Model.schema, 'inspector.Alias');

        // addToSet ile target modele push et
        this._emitter.on(`${lower}_model_saved`, data => {
            const doc       = data.doc;
            const SourceVal = doc[Alias[source]];
            
            if( ! SourceVal )
                return false;

            const update      = {$addToSet: {}};
            const type        = Object.prototype.toString.call(SourceVal);
            const TargetField = ModelAlias[target[1]];
            
            if(type == '[object Array]') 
                update.$addToSet[TargetField] = {$each: SourceVal};
            else
                update.$addToSet[TargetField] = SourceVal;

            // update reference
            self.update_hook(doc[Alias[target[0]]], update, Model, TargetField);
        });

        this._emitter.on(`${lower}_model_removed`, data => {
            const doc       = data.doc;
            const SourceVal = doc[Alias[source]];

            if( ! SourceVal )
                return false;
            
            const pull        = {$pull: {}};
            const pullAll     = {$pullAll: {}};
            const type        = Object.prototype.toString.call(SourceVal);
            const TargetField = ModelAlias[target[1]];
            let update;
            
            if(type == '[object Array]') {
                pullAll.$pullAll[TargetField] = SourceVal;
                update = pullAll;
            }
            else {
                pull.$pull[TargetField] = SourceVal;
                update = pull;
            }

            // update reference
            self.update_hook(doc[Alias[target[0]]], update, Model, TargetField);
        });
    }

    update_hook(id, update, Model, TargetField) {
        const self = this;
        
        Model.update({_id: id}, update, {}, (err, raw) => {
            if(err)
                self._log.error('LIBPOST:MODEL:LOADER:HOOK_PUSH', err);

            // find and save target model
            Model.findOne({_id: id}, (err, doc) => {
                if( err || ! doc )
                    return;

                // denormalize içinde vs bu değişkene bakılacak,
                // bu tarz işlemden sonra denormalize çalışmasına gerek yok
                doc.__dismissHook = true;
                
                // set target field as modified
                doc.markModified(TargetField);
                
                // save document
                doc.save(err => {});                
            });
        });
    }

    /**
     * ----------------------------------------------------------------
     * Increment
     * ----------------------------------------------------------------
     */

    _incr(model, field, id, num, decr) {
        num          = Math.abs(parseInt(num || 1));
        const self   = this;
        const Model  = this._mongoose.model(model);
        let cond     = {};
        const update = {$inc: {}};
        let opts     = {multi: true};
        const Alias  = dot.get(Model.schema, 'inspector.Alias');

        if(Alias && Alias[field])
            field = Alias[field];

        // get id type
        const type = Object.prototype.toString.call(id);
        
        if(type == '[object Array]') {
            if( ! id.length ) return false;
            cond = {_id: {$in: id}};
        }
        else {
            cond = {_id: id};
            opts = {multi: false};
        }

        if(decr)
            num *= -1;

        // set update
        update.$inc[field] = num;

        Model.update(cond, update, opts, (err, raw) => {
            if(err)
                self._log.error('LIBPOST:MODEL:LOADER:INCR', err);
        });
    }

    /**
     * ----------------------------------------------------------------
     * Decrement
     * ----------------------------------------------------------------
     */

    _decr(model, field, id, num) {
        this._incr(model, field, id, num, true);
    }

}

module.exports = app => new LibpostModelLoader(app);
