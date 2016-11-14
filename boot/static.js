const express = require('express');
const path    = require('path');

module.exports = app => {

    // get config
    const _env  = app.get('env');
    const _conf = app.lib.bootConf(app, 'static');
    const _dir  = path.dirname(__dirname);

    app.use(express.static(`${_dir}/${_conf.dir || 'public'}`, (_conf.options || {}) ));
    app.use(express.static(`${app.get('basedir')}/${_conf.dir || 'public'}`, (_conf.options || {}) ));

    return true;

};




