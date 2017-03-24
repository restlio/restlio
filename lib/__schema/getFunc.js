const hasOwn = Object.prototype.hasOwnProperty;

exports.getFunc = function getFunc(obj, self, cb) {
    self = self || this;

    // set app id for system objects (before self._model.q)
    if(self._appId) obj.apps = self._appId;

    // set acl owner protection (api response ise owner protection uygula)
    if( ! self._master && self.protect('get') ) {
        // check user id
        if(self._owner.alias) {
            // aggregation çalışabilmesi için object id'ye çevir
            obj[self._owner.alias] = self._mongoose.Types.ObjectId(self._user.toString());
        }
        
        // check profile id
        const profile = self._owner.profile;
        if(profile && self._profile) { // && ! self._master, master kontrolü yukarıda var
            obj[profile.alias] = self._mongoose.Types.ObjectId(self._profile.toString());
        }
    }

    self.log('GET:DATA:NAKED', obj);

    self._model.q(obj, self._config.query, (err, doc, query) => {
        if(query) self.log('GET:DATA:QUERY', query);
        if(err) {
            return cb ? cb(err) : self.errors(err);
        }

        const type = self.type(doc);

        // qtype = find için sonuçları ayrı ayrı self.from'dan geçiriyoruz
        if(type === '[object Array]') {
            if( ! doc.length ) {
                return cb ? cb({name: 'NotFound'}) : self.errors({name: 'NotFound'});
            }

            // distinct query için çevrim yapmıyoruz
            if(self._format && obj.qt !== 'distinct') {
                self.formatFrom(doc);
                self.mask('get', doc);
            }
        } else if(doc && hasOwn.call(doc, 'rows')) { // qtype == findcount için sonuçları ayrı ayrı self.from'dan geçiriyoruz
            if(self._format) {
                self.formatFrom(doc.rows);
                self.mask('get', doc.rows);
            }
        } else if(doc && hasOwn.call(doc, 'count')) {
            // do not anything
        } else if(type === '[object Object]') { // qtype == one için self.from'dan geçiriyoruz
            if(self._format) {
                self.from(doc);
                doc = self.maskOne('get', doc);
            }
        } else {
            return cb ? cb({name: 'NotFound'}) : self.errors({name: 'NotFound'});
        }
        
        // emit single document id
        if(doc && self._api && query.qt === 'one') {
            self._emitter.emit(`${self._name}:one_call`, doc._id.toString());
        }
        
        return cb ? cb(null, doc) : self._http.OK({doc}, self._res);
    });
};

// promise for cache stampede
exports.getPromise = function getPromise(obj, self, cacheNotFound) {
    return new Promise((resolve, reject) => {
        self.getFunc(obj, self, (err, doc) => {
            if(cacheNotFound && err && err.name === 'NotFound') {
                return resolve({});
            }
            
            return err ? reject(err) : resolve(doc);
        });
    });
};
