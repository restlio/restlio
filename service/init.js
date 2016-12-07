module.exports = app => {

    const _env    = app.get('env');
    const _bottle = app.boot.bottle;
    
    _bottle.factory('AppService', container => app); 
    _bottle.factory('ConfigService', container => app.config[_env]); 
    _bottle.factory('ResponseService', container => app.system.response.app); 
    _bottle.factory('CacheService', container => new app.lib.cache(app)); 

};