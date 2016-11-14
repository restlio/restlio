const async = require('async');
const dot   = require('dotty');
const _     = require('underscore');

class AsyncList {
    
    constructor(params, req, res, next) {
        this._params = params || {};
        this._req    = req;
        this._res    = res;
        this._next   = next;
        this._a      = {};
        this._schema = req.app.lib.schema;

        return this;
    }

    execParams(opts) {
        const self  = this;
        const error = opts.err || false;

        return cb => {
            new self._schema(opts.schema).init(self._req, self._res, self._next)[opts.method || 'get'](opts.params, (err, doc) => {
                cb(error ? err : null, doc);
            });
        };
    }

    execAsync(cb) {
        const self = this;

        _.each(this._params, (value, key) => {
            self._a[key] = self.execParams(value);
        });

        async.parallel(self._a, (err, results) => {
            cb(err, results);
        });

    }

}

module.exports = app => AsyncList;
