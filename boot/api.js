const body = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const override = require('method-override');
const helmet = require('helmet');

module.exports = app => {
    const env = app.get('env');
    const helper = app.lib.utils.helper;
    const test = app.get('istest');

    // use helmet
    app.use(helmet());

    // use body parser
    const bodyConf = helper.bootConf('body');
    app.use(body.urlencoded(bodyConf.urlencoded || {}));
    app.use(body.json(bodyConf.json || {}));

    // use morgan
    const skip = (req) => req.baseUrl === '/admin/kue';

    switch(env) {
        case 'development':
        case 'testing':
        case 'staging':
            if( ! test ) {
                app.use(morgan('dev', {skip}));
            }
            break;
        default:
    }

    // use cors
    app.use(cors());
    app.options('*', cors());

    // method override
    app.use(override('X-HTTP-Method-Override'));

    return true;
};
