const Sequelize = require('sequelize');
const dot       = require('dotty');

module.exports = app => {

    const _env    = app.get('env');
    const _log    = app.lib.logger;
    const _conf   = app.config[_env].db || dot.get(app.config[_env], 'data.db');
    const _worker = app.get('workerid');
    const _sConf  = app.config[_env].sync;
    const _logs   = dot.get(_sConf, 'data.core');
    const _group  = `W${_worker}:CORE:DB`;

    if( ! _conf )
        return false;

    if( ! _conf.enabled )
        return false;

    if(_logs)
        _log.info(`${_group}:CONFIG`, _conf, 'black');

    return new Sequelize(_conf.uri);

};