function Get(obj, options, cb) {
    obj = this.clone(obj);

    const self = this;
    const optType = this.type(options);
    
    // options parametresi function olarak geçirilmişse callback olarak bunu seçiyoruz
    const _cb = (optType === '[object Function]') ? options : cb;

    // cache key'i belirliyoruz
    // cache key direkt obje içinde veya options içinde belirtilebilir
    let cacheKey;
    if(obj.cacheKey) {
        cacheKey = obj.cacheKey;
        delete obj.cacheKey;
    } else if(optType === '[object Object]') {
        cacheKey = options.cacheKey;
    }

    // core cache ve cache key varsa cache'i çalıştırıyoruz
    if(this._app.core.cache && cacheKey) {
        // objeyi ve class'ı cache-stampede içinde kullanılabilmesi için
        // parametre olarak geçiriyoruz
        const params = {params: [obj, self]};
        if(obj.expiry) { // in ms
            params.expiry = obj.expiry;
            delete obj.expiry;
        }

        if(obj.cacheNotFound) {
            params.params.push(true);
            delete obj.cacheNotFound;
        }
        
        this._app.core.cache.cached(`api:${cacheKey}`, this.getPromise, params)
        .then(doc => {
            self.log('CACHE', cacheKey);
            return _cb ? _cb(null, doc) : self._http.OK({doc}, self._res);
        }, err => {
            self.log(`CACHE:${cacheKey}`, err);
            self.errors(err, _cb);
        });
    } else {
        this.getFunc(obj, null, _cb);
    }
}

module.exports = Get;
