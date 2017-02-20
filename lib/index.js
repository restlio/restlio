const EventEmitter = require('events').EventEmitter;

module.exports = app => {
    if( ! app.lib ) app.lib = {};

    // set max listeners
    const Emitter = new EventEmitter();
    Emitter.setMaxListeners(0);
    app.lib.schemaEmitter = Emitter;

    return true;
};
