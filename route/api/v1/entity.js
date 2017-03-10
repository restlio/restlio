const async = require('async');
const dot = require('dotty');
const _ = require('underscore');
const debug = require('debug')('RESTLIO:ROUTE:API:ENTITY');

module.exports = app => {
    const _mdl = app.middle;
    const _schema = app.lib.schema;
    const _resp = app.system.response.app;
    const _emitter = app.lib.schemaEmitter;

    const updateItem = (Item, cond, update, id, name, type, value, field) => cb => {
        Item.update(cond, update, {multi: false}, (err, raw) => {
            if(raw && raw.nModified) {
                debug('EMITTED %s', name + type);
                _emitter.emit(name + type, {id, value});
            }
            
            cb(null, {
                field,
                type,
                value,
                affected : raw.nModified,
            });
        });
    };
    
    /**
     * ----------------------------------------------------------------
     * Add User to Set (add to field, remove from pair)
     * ----------------------------------------------------------------
     */
    
    app.put('/entity/:object/:id/:field/:field_val?',
        _mdl.api,
        _mdl.client,
        _mdl.appdata,
        _mdl.auth,
        _mdl.acl,
        _mdl.entity.check,
        _mdl.entity.middleware,
    (req, res, next) => {
        const schema = new _schema(req.params.object).init(req, res, next);

        if(schema) {
            const entity = req.__entityAcl;
            const id = req.params.id;
            const field = req.params.field;
            const object = req.params.object.toLowerCase().replace('.', '_');
            const name = `${object}_${field}_`;
            const Item = schema._model;
            const cond = {_id: id};
            let update = {};
            const props = dot.get(schema._save, `properties.${entity.short}`);
            const a = [];

            // TODO: each operator kullan
            if(entity.type === 'array') {
                _.each(entity.setValArr, (value) => {
                    // add to set
                    update = {$addToSet: {}};
                    update.$addToSet[entity.short] = value;
                    a.push(updateItem(Item, cond, _.clone(update), id, name, 'addtoset', value, field));

                    // remove from pair
                    if(entity.pair) {
                        update = {$pull: {}};
                        update.$pull[entity.pair] = value;
                        a.push(updateItem(Item, cond, _.clone(update), id, `${object}_${props.pair}_`, 'pull', value, props.pair));
                    }
                });
                
                async.parallel(a, (err, results) => {
                    _resp.OK(results, res);
                });
            } else {
                // set field value
                update = {$set: {}};
                update.$set[entity.short] = entity.setVal;
                
                // check owner
                if(props.owner) {
                    cond[schema._alias[props.owner]] = req.__user.id;
                }

                schema.validate(schema._update, update, (err, valid) => {
                    if(valid.error.length) {
                        return schema.errors({name: 'ValidationError', errors: valid.error});
                    }

                    a.push(updateItem(Item, cond, update, id, name, 'set', entity.setVal, field));
                    
                    async.parallel(a, (err, results) => {
                        _resp.OK(results, res);
                    });

                    return false;
                });
            }
        }
    });

    /**
     * ----------------------------------------------------------------
     * Neutralize Action (remove from field and pair)
     * ----------------------------------------------------------------
     */
    
    app.delete('/entity/:object/:id/:field/:field_val?',
        _mdl.api,
        _mdl.client,
        _mdl.appdata,
        _mdl.auth,
        // _mdl.acl, DELETE isteği gelmesi için acl'de delete izni vermek gerekiyor
        // delete izni vermeden bu endpoint'in çalışması lazım
        _mdl.entity.check,
        _mdl.entity.middleware,
    (req, res, next) => {
        const schema = new _schema(req.params.object).init(req, res, next);

        if(schema) {
            const entity = req.__entityAcl;
            const id     = req.params.id;
            const field  = req.params.field;
            const object = req.params.object.toLowerCase().replace('.', '_');
            const name   = `${object}_${field}_`;
            const Item   = schema._model;
            const cond   = {_id: id};
            let update   = {};
            const props  = dot.get(schema._save, `properties.${entity.short}`);
            const a      = [];
            
            if(entity.type === 'array') {
                _.each(entity.setValArr, (value) => {
                    // pull from field
                    update = {$pull: {}};
                    update.$pull[entity.short] = value;
                    a.push(updateItem(Item, cond, update, id, name, 'pull', value, field));
                    
                    // pull from pair
                    if(entity.pair) {
                        update = {$pull: {}};
                        update.$pull[entity.pair] = value;
                        a.push(updateItem(Item, cond, update, id, `${object}_${props.pair}_`, 'pull', value, props.pair));
                    }
                });

                async.parallel(a, (err, results) => {
                    _resp.OK(results, res);
                });
            } else {
                _resp.OK({}, res);
            }
        }
    });
};
