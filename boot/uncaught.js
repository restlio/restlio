module.exports = app => {

    const _log   = app.lib.logger;
    const _group = 'UNCAUGHT:EXCEPTION';

    process.on('uncaughtException', err => {
        _log.error(_group, err);
    });

    return true;

};




