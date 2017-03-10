const async = require('async');
const dot = require('dotty');
const _ = require('underscore');
const debug = require('debug')('RESTLIO:DENORMALIZE');

// speed up calls
const toString = Object.prototype.toString;
function transform(doc) {
    return doc;
}

class Denormalize {

    constructor(app) {
        this._app = app;
        this.helper = app.lib.utils.helper;
        this._mongoose = app.core.mongo.mongoose;
        this._models = {};

        return this;
    }

    /**
     * ----------------------------------------------------------------
     * Denormalize Process
     * ----------------------------------------------------------------
     */

    process(doc, inspector, cb) {
        const self = this;
        const save = inspector.Save;
        const denorm = inspector.Denorm;
        const alias = inspector.Alias;
        const vals = {};
        const a = [];

        // return yaparken cb()'yi çağırmayı unutma
        if( ! denorm ) {
            debug('PROCESS inspector.Denorm not found');
            return cb();
        }

        // _dismissHook değişkeni geldiğinde denormalization çalıştırılmayacak
        if(doc.__dismissHook) return cb();
        
        // collect ids for references
        _.each(save.properties, (value, key) => {
            if(value.ref && denorm[value.ref]) {
                if( ! vals[value.ref] ) {
                    vals[value.ref] = [];
                }
                    
                if(doc[key]) {
                    if(toString.call(doc[key]) === '[object Array]') {
                        _.each(doc[key], kV => {
                            if(kV) {
                                if(toString.call(kV.toString) === '[object Function]') {
                                    kV = kV.toString();
                                }

                                vals[value.ref].push(kV);
                            }
                        });
                    } else {
                        vals[value.ref].push(doc[key]);
                    }
                }
            }
        });

        // query references with unique ids
        _.each(vals, (value, key) => {
            value = _.uniq(value);

            (((a, model, doc, value, mongoose, denorm, alias) => {
                if( ! denorm[model] ) {
                    return debug('PROCESS inspector.Denorm[model] not found');
                }

                let target = _.clone(denorm[model].target);
                let targets = denorm[model].targets;
                let fields = _.clone(denorm[model].fields);

                if( ! target && ! targets ) {
                    if( ! target ) {
                        debug('PROCESS inspector.Denorm[model].target not found');
                    }
                    if( ! targets ) {
                        debug('PROCESS inspector.Denorm[model].targets not found');
                    }

                    return false;
                }

                /* TARGET */
                if(alias[target]) target = alias[target];

                if( ! doc[target] ) doc[target] = {};

                // mixed ve date field'larda modified olarak işaretlenmezse
                // denormalize worker'ları çalıştığında güncellemiyor
                // (target field'ı data_profiles vs gibi her zaman mixed olarak belirtiliyor)
                if(target) { // ör: d_p => data_profiles
                    doc.markModified(target);
                }

                /* TARGETS */
                if(targets) {
                    targets = _.clone(targets.fields);

                    // change alias for target fields
                    _.each(targets, (tSource, tTarget) => {
                        if(alias[tTarget]) {
                            targets[alias[tTarget]] = tSource;
                        }

                        // TODO: tTarget ve alias[tTarget]'in eşit olması durumunda silinmeyecek
                        delete targets[tTarget];
                    });
                }

                // model
                const m = mongoose.model(model);
                const mAlias = dot.get(m.schema, 'inspector.Alias');
                fields = fields ? fields.split(',') : [];

                if(mAlias) {
                    _.each(fields, (field, index) => {
                        if(mAlias[field]) {
                            fields[index] = mAlias[field];
                        }
                    });

                    // change alias for source fields
                    _.each(targets, (tSource, tTarget) => {
                        if(mAlias[tSource]) {
                            targets[tTarget] = mAlias[tSource];
                            fields.push(mAlias[tSource]);
                        }
                    });
                }

                if(fields.length) {
                    fields = _.uniq(fields);
                }

                a.push(cb => {
                    try {
                        if( ! value || ! value.length ) {
                            return cb();
                        }
                        
                        m.find({_id: {$in: value}}, fields.join(' '), (err, data) => {
                            if(err) {
                                self.helper.log('error', err);
                            }
                            
                            if(data) {
                                if(target) {
                                    _.each(data, (dVal) => {
                                        doc[target][dVal._id.toString()] = dVal;
                                    });
                                }

                                // targets sadece tekil field'lar için denormalize edilecek
                                // target field type=array kontrolü koy
                                if(targets && data.length === 1) {
                                    _.each(targets, (tSource, tTarget) => {
                                        if(data[0] && data[0][tSource]) {
                                            doc[tTarget] = data[0][tSource];
                                        }
                                    });
                                }
                            }

                            cb(null, data);
                        });
                    } catch(e) {
                        self.helper.log('error', e);
                        cb(null);
                    }

                    return false;
                });

                return false;
            }))(a, key, doc, value, self._mongoose, denorm, alias);
        });

        async.parallel(a, (err) => {
            if(err) {
                self.helper.log('error', err);
            }

            cb();
        });

        return false;
    }

    /**
     * ----------------------------------------------------------------
     * Denormalize Touch
     * ----------------------------------------------------------------
     */

    touch(data, inspector) {
        const self = this;
        const name = inspector.Name;
        const denorm = inspector.Denorm;
        const alias = inspector.Alias;
        const source = data.source;
        const doc = data.doc;

        if( ! name ) return debug('TOUCH inspector.Name not found');
        else if( ! denorm ) return debug('TOUCH inspector.Denorm not found');
        else if( ! source ) return debug('TOUCH data.source not found');
        else if( ! doc ) return debug('TOUCH data.doc not found');

        if(denorm[source]) {
            let fields = _.clone(denorm[source].fields);
            let target = _.clone(denorm[source].target);
            let targets = denorm[source].targets;
            const docId = doc._id.toString();
            const updates = {$set: {}};
            let cond = {};
            
            debug(`TOUCH ${name}:_from_:${source}:${docId}`);
            fields = fields ? fields.split(',') : [];

            if(alias[target]) {
                target = alias[target];
            }

            // change alias for target fields
            let tMain;
            if(targets) {
                tMain = _.clone(targets.source);
                targets = _.clone(targets.fields);

                _.each(targets, (tSource, tTarget) => {
                    if(alias[tTarget]) {
                        targets[alias[tTarget]] = tSource;
                    }

                    // TODO: tTarget ve alias[tTarget]'in eşit olması durumunda silinmeyecek
                    delete targets[tTarget];
                });

                if(alias[tMain]) {
                    tMain = alias[tMain];
                }
            }

            // direkt obje şeklinde set etmeye kalkarsak komple denormalize objesini elimizdeki data ile replace eder
            // bu yüzden dot notation şeklinde update edeceğiz (field._id.sub_field = value)
            const updateKey = `${target}.${docId}`;

            // set update condition
            cond[`${target}.${docId}`] = {$exists: true};

            // get mongoose doc
            const _doc = dot.get(data, 'doc._doc');

            if(_doc) {
                // source model
                const sModel = self._mongoose.model(source);
                const sAlias = dot.get(sModel.schema, 'inspector.Alias');

                if(sAlias) {
                    _.each(fields, (field, index) => {
                        if(sAlias[field]) {
                            fields[index] = sAlias[field];
                        }
                    });

                    // change alias for source fields
                    _.each(targets, (tSource, tTarget) => {
                        if(sAlias[tSource]) {
                            targets[tTarget] = sAlias[tSource];
                        }
                    });
                }

                _.each(_doc, (value, key) => {
                    // TODO: mixed ve date field'lar modified olarak gelmeyebilir, bu durum test edilecek
                    if( doc._isModified && ! doc._isModified[key] ) {
                        return false;
                    }

                    if(fields.includes(key)) {
                        updates.$set[`${updateKey}.${key}`] = value;
                    }

                    return false;
                });

                // targets sadece tekil field'lar için denormalize edilecek, target field type=array kontrolü koy
                if(targets) {
                    _.each(targets, (tSource, tTarget) => {
                        if(_doc && _doc[tSource]) {
                            updates.$set[tTarget] = _doc[tSource];
                        }
                    });
                }

                // override condition if only targets exists
                if( targets && ! target ) {
                    cond = {};
                    cond[tMain] = docId;
                }

                // eğer $set objesi boş gelmişse işlem yapma
                if( ! Object.keys(updates.$set).length ) {
                    return false;
                }

                // update model
                const model = self._mongoose.model(name);
                
                model.update(cond, updates, {multi: true}, (err, affected) => {
                    if(err) {
                        return self.helper.log('error', err);
                    }

                    return debug('TOUCH affected %o', affected);
                });
            }
        }

        return false;
    }

    /**
     * ----------------------------------------------------------------
     * Denormalize Size (count array size)
     * ----------------------------------------------------------------
     */

    size(doc, inspector) {
        // set doc
        const Doc = doc.doc; // data şu şekilde geliyor => {source: 'Model_Name', doc: doc}
        const self = this;
        const name = inspector.Name;
        const size = inspector.Size;
        const alias = inspector.Alias;
        const update = {$set: {}};
        let clone;

        if( ! name ) return debug('SIZE inspector.Name not found');
        else if( ! size ) return debug('SIZE inspector.Size not found');

        // update model
        const docId = Doc._id.toString();
        const model = self._mongoose.model(name);
        const aggr = [];
        const match = {$match: {_id: self._mongoose.Types.ObjectId(docId)}};
        const project = {$project: {}};

        _.each(size, (value, key) => {
            if(alias[value]) value = alias[value];
            if(alias[key]) key = alias[key];

            // eğer modifiye edilmediyse size almıyoruz
            if( Doc._isModified && ! Doc._isModified[key] ) {
                return false;
            }
            
            project.$project[value] = {$size: `$${key}`};
            return false;
        });

        // eğer $project objesi boş gelmişse işlem yapma
        if( ! Object.keys(project.$project).length ) {
            return false;
        }

        aggr.push(match);
        aggr.push(project);

        model.aggregate(aggr, (err, result) => {
            if(err) {
                return self.helper.log('error', err);
            }

            if( ! result[0] ) {
                return debug('SIZE aggregate result %o', result);
            }

            result = result[0];
            clone = _.clone(result);
            delete clone._id;

            _.each(clone, (value, key) => {
                update.$set[key] = value;
            });

            model.update({_id: docId}, update, {}, (err, affected) => {
                if(err) {
                    return self.helper.log('error', err);
                }

                return debug('SIZE affected %o', affected);
            });

            return false;
        });

        return false;
    }

    /**
     * ----------------------------------------------------------------
     * Denormalize Sync
     * ----------------------------------------------------------------
     */

    sync(model, kue) {
        const self = this;

        if(self._app.get('isworker')) {
            return debug('SYNC start failed (because this is worker instance)');
        }

        // update model
        const m = self._mongoose.model(model);
        const stream = m.find({}).stream({transform});

        stream.on('data', doc => {
            debug(`SYNC ${model} doc denormalize job: ${doc._id.toString()}`);

            kue.create('denormalize-document', {
                title: 'Denormalize document',
                params: {
                    type: 'denormalize-document',
                    model,
                    id: doc._id.toString(),
                },
            }).attempts(3).removeOnComplete(true).save();
        }).on('error', err => {
            self.helper.log('error', err);
        }).on('end', () => {
            debug(`SYNC ${model} stream end`);
        });

        return stream;
    }
    
}

module.exports = app => new Denormalize(app);
