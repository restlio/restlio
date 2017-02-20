const parser = require('parseable').operationParser;
const async = require('async');
const dot = require('dotty');
const _ = require('underscore');

const hasOwn = Object.prototype.hasOwnProperty;

function Put(id, obj, cb) {
    let where = false;
    if(this.type(id) === '[object Object]' && id.where) {
        where = id.where;
    }

    const self = this;
    const Item = this._model;
    const cond = {_id: id}; // where conditions
    const a = [];
    const unset = null;

    // allow for only current app
    if(this._appId) {
        if(where) where.ap = this._appId;
        else cond.ap = this._appId;
    }

    // set acl owner protection (api response ise owner protection uygula)
    if( ! this._master && this.protect('put') ) {
        const ownerField = this._alias[this._owner.alias];
        
        if(where) where[ownerField] = this._user;
        else cond[ownerField] = this._user;
    }

    obj = this.clone(obj);
    this.log('PUT:DATA:NAKED', obj);
    
    // sanitize value for $inc
    _.each(obj, (value, key) => {
        if(value.__op && value.__op === 'Increment' && value.amount) {
            obj[key].amount = parseInt(value.amount, 10);
        }
    });

    // parser ops => number: inc, array: pushAll, addToSet, pull, pullAll
    const _ops = ['$set', '$unset', '$inc', '$pushAll', '$addToSet', '$pull', '$pullAll'];
    const _update = self.clone(self._update);
    const _attrs = ['pattern'];

    // mixed olarak kaydedilecek field'larda parser'dan geçmemesi lazım
    // key'leri dot notation'la birleştirdiği için şemada bulunamıyor
    // TODO: mixed field'a izin verilen durum kaldırılabilir
    if(self._req && self._req.headers['x-put-mixed']) {
        obj = self.maskOne('put', obj);
        self.log('PUT:DATA:MASKED:$set', obj);
        self.to(obj, true); // keepEmpty = true
        a.push(cb2 => cb2(null, {$set: obj}, false)); // unset = false
    } else {
        a.push(cb3 => { // parse params
            parser(obj, (err, parsed) => {
                if(err) err = {name: 'ParserError', message: err};
                self.log('PUT:DATA:PARSED', parsed);
                cb3(err, parsed, unset);
            });
        });
    }

    // validate
    a.push((parsed, unset, cb) => {
        if(parsed) {
            // change properties alias with key
            _.each(_ops, (value) => {
                if(parsed[value]) {
                    // execute mask
                    // TODO: mask çalıştırırken operasyona göre de maskeleme de eklenebilir
                    // put: {owner: 'myfield'} yerine
                    // put: {owner: {$set: 'myfield1', $inc: 'myfield2'}} gibi
                    parsed[value] = self.maskOne('put', parsed[value]);
                    self.log(`PUT:DATA:MASKED:${value}`, parsed[value]);
                    self.to(parsed[value], true); // keepEmpty = true
                }
            });

            // eğer update edilirken $set'e boş değer geçirilirse field'ı update eder
            // ama eğer pattern vs gibi kurallar tanımlanmışsa hata atar
            // bunu engellemek için değer yoksa validation'dan çıkarıyoruz
            if(parsed.$set) {
                _.each(parsed.$set, (value, key) => {
                    const props = self._save.properties[key];
                    
                    if( ! value || value === '' ) {
                        // değer gelmeyen enum'lar validation'da hata veriyor
                        // TODO: hatayı tekrarla, duruma göre if(props.eq) kontrolü kaldırabilir
                        if(props.eq) delete parsed.$set[key];
                        
                        _.each(_attrs, attr => {
                            dot.remove(_update.properties, `$set.properties.${key}.${attr}`);
                            dot.remove(_update.properties, `$set.properties.${key}.items.${attr}`);
                        });
                    }
                });
            }
        
            // unset'in sanitization'dan geçmemesi lazım, burada kaldırıyoruz
            if(parsed.$unset) {
                unset = parsed.$unset;
                delete parsed.$unset;
            }
        }
        
        self.validate(_update, parsed, (err, result) => {
            if(result.error.length) {
                return cb({name: 'ValidationError', errors: result.error});
            }

            // unset varsa ekliyoruz
            if(parsed && unset) parsed.$unset = unset;

            return cb(err, parsed);
        });
    });

    // check item
    if( ! where ) {
        this.header('X-Restlio-Put-Condition', cond);

        a.push((parsed, cb) => {
            Item.findOne(cond, (err, doc) => {
                if( ! doc ) return cb({name: 'NotFound'});

                if(self._dismissHook) {
                    doc.__dismissHook = true;
                }
                
                return cb(err, parsed, doc);
            });
        });
    }

    async.waterfall(a, (err, parsed, doc) => {
        if(err) return self.errors(err, cb);

        // protect app id
        // (unset edilebilmesi için ap = '' geldiği için property kontrolü yapıyoruz)
        if(self._appId && parsed.$set && hasOwn.call(parsed.$set, 'ap')) {
            delete parsed.$set.ap;
        }
            
        if(self._appId && parsed.$unset && hasOwn.call(parsed.$unset, 'ap')) {
            delete parsed.$unset.ap;
        }

        // set acl owner protection (api response ise owner protection uygula)
        if( ! self._master && self.protect('put') ) {
            const alias = self._owner.alias;
            const field = self._alias[alias];
            const profile = self._owner.profile;

            if(parsed.$set && hasOwn.call(parsed.$set, field)) {
                delete parsed.$set[field];
            }
                
            if(parsed.$unset && hasOwn.call(parsed.$unset, field)) {
                delete parsed.$unset[field];
            }

            // check profile id
            if(profile) {
                const pField = self._alias[profile.alias];

                if (parsed.$set && hasOwn.call(parsed.$set, pField)) {
                    delete parsed.$set[pField];
                }

                if (parsed.$unset && hasOwn.call(parsed.$unset, pField)) {
                    delete parsed.$unset[pField];
                }
            }
        }

        // eğer where koşulu varsa koşula göre update ediyoruz (multi = true)
        if(where) {
            Item.update(where, parsed, {multi: true}, (err, raw) => {
                if(err) return self.errors(err, cb);
                const affected = raw.n;
                const modified = raw.nModified;
                return cb ? cb(null, modified) : self._http.OK({affected, modified}, self._res);
            });
        } else if(Object.keys(parsed).length === 1 && parsed.$set) {
            // eğer sadece set işlemi yapıyorsak, doc.save çalıştıracağız
            // (hook'ların vs çalışması için)

            doc._original = _.clone(doc.toJSON()); // set original doc for post.save hook

            _.each(parsed.$set, (value, key) => {
                const type = self.type(value);
                const fType = self._save.properties[key].ftype;

                // object id = '' gelirse mongoose cast hatası atıyor, null'e eşitliyoruz
                if( ! value && fType === 'objectid') {
                    value = null;
                } else if(type === '[object Array]' && value.length && value[0] === '') {
                    // eğer object id = [''] gelirse mongoose cast hatası atıyor
                    value = []; // array'e eşitliyoruz
                }
                    
                doc[key] = value;
            });

            doc.save(err => {
                if(err) return self.errors(err, cb);
                return cb ? cb(null, 1) : self._http.OK({affected: 1}, self._res);
            });
        } else {
            Item.update(cond, parsed, (err, raw) => {
                if(err) return self.errors(err, cb);
                const affected = raw.n;
                const modified = raw.nModified;
                return cb ? cb(null, modified) : self._http.OK({affected, modified}, self._res);
            });
        }

        return false;
    });
}

module.exports = Put;
