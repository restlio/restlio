class Cache {

    constructor(app) {
        this._app = app;
        this._env = app.get('env');
        this.helper = app.lib.utils.helper;
        return this;
    }

    getPromise() {
        const args = [].slice.call(arguments, 0); // arguments'i diziye çevir
        const myObj = args[0]; // main object
        const myFunc = args[1]; // function
        
        // get parameters
        args.splice(0, 2);
        const myParams = args;

        // cache hit
        myObj.hit = true;

        return new Promise((resolve, reject) => {
            // add callback to parameters
            myParams.push((err, value) => {
                return err ? reject(err) : resolve(value);
            });

            // apply function
            myFunc.apply(myObj, myParams);
        });
    }

    // parameters = array
    run(myObj, myFunc, parameters, opts, cb) {
        const self = this;
        myObj = myObj || {};
        opts = opts || {};
        parameters = parameters || [];
        const cacheKey = opts.cacheKey;

        // prepend function as parameter
        parameters.unshift(myFunc);

        // prepend main object as parameter
        parameters.unshift(myObj);
        
        // core cache ve cache key varsa cache'i çalıştırıyoruz
        if(this._app.core.cache && cacheKey) {
            // objeyi, fonksiyonu vs. cache-stampede içinde kullanılabilmesi için parametre olarak geçiriyoruz
            const params = {params: parameters};
            if(opts.expiry) { // in ms
                params.expiry = opts.expiry;
            }

            this._app.core.cache.cached(`cache:${cacheKey}`, this.getPromise, params)
            .then(doc => {
                cb(null, doc);
            }, err => {
                self.helper.log('error', err);
                cb(err);
            });
        }
    }

    async(myObj, myFunc, parameters, opts, errNull) {
        const self = this;
        
        return cb => {
            self.run(myObj, myFunc, parameters, opts, (err, doc) => {
                cb(errNull ? null : err, doc);
            });
        };
    }
    
    exec(myObj, myFunc, parameters, opts, errNull, cb) {
        const self = this;
        self.run(myObj, myFunc, parameters, opts, (err, doc) => {
            cb(errNull ? null : err, doc);
        });
    }

}

module.exports = () => Cache;
