const winston = require('winston');
const _       = require('underscore');

module.exports = app => {

    const _env  = app.get('env');
    const _conf = app.config[_env].logger; // logger config

    winston.emitErrs = false; // don't supress errors
    const logger = new winston.Logger({exitOnError: false});

    // add transport
    logger.add(winston.transports[_conf.transport], _conf.options);

    return logger;

};

