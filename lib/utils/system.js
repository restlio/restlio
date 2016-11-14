const _ = require('underscore');

// speed up calls
const toString = Object.prototype.toString;

class System {

    constructor(app) {
        this._app = app;
    }

    hash(passwd, salt) {

    }
    
}

module.exports = app => new System(app);
