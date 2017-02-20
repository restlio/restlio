const debug = require('debug');
const _ = require('underscore');

module.exports = app => {
    const log = debug('RESTLIO:BOOT:SERVICE');
    app._loadedServices = [];

    _.each(app._services, value => {
        const _name = value.loader.name;
        const _depends = value.loader.depends || [];

        if(typeof value.loader !== 'function') {
            return log(`The ${_name} service is not a function`);
        }

        if(_depends.length) {
            const _diff = _.difference(_depends, app._loadedServices);
            if(_diff.length) {
                return log(`The ${_name} service depends on the [${_diff.join(', ')}] services`);
            }
        }
        
        value.loader.call(app, value.opts);
        app._loadedServices.push(_name);
        log(`Service loaded: ${_name}, depends on: [${_depends.join(', ')}]`);
    });

    return true;
};
