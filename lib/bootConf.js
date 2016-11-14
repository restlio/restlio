const dot = require('dotty');

function BootConf(app, name) {
    const _env  = app.get('env');
    const _name = app.get('name');

    const _appC = dot.get(app.config, [_env, _name, 'boot', name].join('.'));
    const _defC = dot.get(app.config, [_env, 'boot', name].join('.'));

    return _appC || _defC;
}

module.exports = app => BootConf;
