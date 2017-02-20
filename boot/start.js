const Bottle = require('bottlejs');
const winston = require('winston');

module.exports = app => {
    const _env = app.get('env');

    // set winston
    winston.emitErrs = false; // don't supress errors
    const _logConf = app.config[_env].logger;
    const logger = new winston.Logger({exitOnError: false});

    // add transport
    logger.add(winston.transports[_logConf.transport], _logConf.options);

    app.system = {logger};

    // set uncaught exception
    process.on('uncaughtException', err => {
        // console.log('uncaughtException', err);
    });
    
    // set container
    Bottle.config = {strict: true};
    app.boot.bottle = new Bottle();

    return true;
};
