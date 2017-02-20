const dot = require('dotty');
const _ = require('underscore');

exports.stream = function stream(obj, cb) {
    obj = obj || {};
    obj.qt = 'stream';
    obj = this.clone(obj);

    this._model.q(obj, this._config.query, (err, stream) => {
        cb(null, stream);
    });
};

exports.aggregate = function aggregate(ops, cb) {
    const self = this;
    const Item = self._model;

    Item.aggregate(ops, (err, doc) => {
        if(err) return self.errors(err, cb);
        if( ! doc ) return self.errors({name: 'NotFound'}, cb);

        return cb ? cb(null, doc) : self._http.OK({doc}, self._res);
    });
};

exports.populate = function populate(docs, opts, cb) {
    const self = this;
    const Item = self._model;
    opts = opts || {path: '_id'};
    
    Item.populate(docs, opts, (err, populated) => {
        if(self._format) {
            _.each(populated, doc => {
                if(doc && opts.path && doc[opts.path]) {
                    const curr = JSON.parse(JSON.stringify(doc[opts.path]));
                    self.from(curr);
                    doc[opts.path] = curr;
                }
            });
        }
        
        cb(null, populated);
    });
};

exports.search = function search(query, options, cb) {
    const self = this;
    const Item = this._model;

    Item.search(query || {}, options || {}, (err, doc) => {
        let hits = [];
        let total = 0;
        let type;

        if(doc) {
            type = self.type(doc.hits.hits);
            hits = doc.hits.hits;
            total = doc.hits.total;

            if(type === '[object Array]') {
                if( ! hits.length ) {
                    return cb ? cb({name: 'NotFound'}) : self.errors({name: 'NotFound'}, cb);
                }

                if(self._format) {
                    _.each(hits, (value, key) => {
                        self.from(value);
                        dot.put(hits, `${key}`, value);
                    });
                }
            }
        }

        return cb ? cb(null, {hits, total}) : self._http.OK({doc: hits, total}, self._res);
    });
};
