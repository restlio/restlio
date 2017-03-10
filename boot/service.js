const debug = require('debug');
const _ = require('underscore');

module.exports = app => {
    const log = debug('RESTLIO:BOOT:SERVICE');
    app._loadedServices = [];

    _.each(app._services, value => {
        const name = value.loader.name;
        const depends = value.loader.depends || [];

        if(typeof value.loader !== 'function') {
            return log(`The ${name} service is not a function`);
        }

        if(depends.length) {
            const diff = _.difference(depends, app._loadedServices);
            if(diff.length) {
                return log(`The ${name} service depends on the [${diff.join(', ')}] services`);
            }
        }
        
        value.loader.call(app, value.opts);
        app._loadedServices.push(name);
        log(`Service loaded: ${name}, depends on: [${depends.join(', ')}]`);
    });

    return true;
};
