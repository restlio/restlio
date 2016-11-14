module.exports = app => {

    const _group = 'BOOT:ENV';
    
    _log.info(`${_group}:PROCESS_ENV`, process.env);
    _log.info(`${_group}:APP_NAME`, app.get('name'));
    _log.info(`${_group}:APP_ENV`, app.get('env'));
    _log.info(`${_group}:APP_PORT`, app.get('port'));
    _log.info(`${_group}:APP_BASEDIR`, app.get('basedir'));

    return true;

};




