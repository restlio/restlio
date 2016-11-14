const favicon = require('serve-favicon');

module.exports = app => {

    const _conf  = app.lib.bootConf(app, 'favicon');
    let fileName = 'favicon.ico';
    
    if(_conf && _conf.fileName)
        fileName = _conf.fileName;
    
    app.use(favicon(`${app.get('basedir')}/public/${fileName}`));
    
    return true;
    
};




