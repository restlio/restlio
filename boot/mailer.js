const mailer = require('nodemailer');
const _ = require('underscore');

module.exports = app => {
    const conf = app.lib.utils.helper.bootConf('mailer');
    
    if( ! conf ) {
        return false;
    }

    // birden fazla config varsa hepsi için client oluşturuyoruz
    if( ! conf.service ) {
        const obj = {};
        _.each(conf, (val, key) => {
            obj[key] = mailer.createTransport(val);
        });

        return obj;
    }
    
    return mailer.createTransport(conf);
};
