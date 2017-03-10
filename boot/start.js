const Bottle = require('bottlejs');
const winston = require('winston');
const dot = require('dotty');

module.exports = app => {
    const env = app.get('env');

    // set winston
    winston.emitErrs = false; // don't supress errors
    const logConf = app.config[env].logger;
    const logger = new winston.Logger({exitOnError: false});

    // add transport (usually console)
    logger.add(winston.transports[logConf.transport], logConf.options);

    app.system = {logger};

    // set uncaught exception
    process.on('uncaughtException', err => {
        err.source = 'uncaught';
        app.lib.utils.helper.log('error', err);
    });
    
    // set container
    Bottle.config = {strict: true};
    app.boot.bottle = new Bottle();

    return true;
};
