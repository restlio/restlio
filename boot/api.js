const body = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const override = require('method-override');
const helmet = require('helmet');

module.exports = app => {
    const _env = app.get('env');
    const _helper = app.lib.utils.helper;
    const _test = app.get('istest');

    // use helmet
    app.use(helmet());

    // use body parser
    const _bodyConf = _helper.bootConf('body');
    app.use(body.urlencoded(_bodyConf.urlencoded || {}));
    app.use(body.json(_bodyConf.json || {}));

    // use morgan
    const _skip = (req) => req.baseUrl === '/admin/kue';

    switch(_env) {
        case 'development':
        case 'testing':
        case 'staging':
            if( ! _test ) {
                app.use(morgan('dev', {skip: _skip}));
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
