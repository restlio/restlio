const mailer = require('nodemailer');
const pool = require('nodemailer-smtp-pool');
const _ = require('underscore');

module.exports = app => {
    const _conf = app.lib.utils.helper.bootConf('mailer');
    
    if( ! _conf ) {
        return false;
    }

    // birden fazla config varsa hepsi için client oluşturuyoruz
    if( ! _conf.service ) {
        const obj = {};
        _.each(_conf, (val, key) => {
            obj[key] = mailer.createTransport(pool(val));
        });

        return obj;
    }
    
    return mailer.createTransport(pool(_conf));
};
