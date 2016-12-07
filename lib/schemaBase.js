const Schema = require('./schema')();

class Base extends Schema {
    
    constructor(name) {
        super(name);
    }

    getAll(opts, cb) {
        this.get(opts, cb);
    }

}

module.exports = app => Base;
