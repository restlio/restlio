const EventEmitter = require('events').EventEmitter;

module.exports = app => {

    const Emitter = new EventEmitter();

    // set max listeners
    Emitter.setMaxListeners(0);

    return Emitter;

};