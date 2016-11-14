const morgan = require('morgan');

module.exports = app => {

    const _env  = app.get('env');
    const _skip = (req, res) => req.baseUrl == '/admin/kue';

    switch(_env) {
        case 'development':
            app.use(morgan('dev', {skip: _skip}));
            break;

        case 'testing':
            app.use(morgan('short', {skip: _skip}));
            break;

        case 'production':
            app.use(morgan('short', {skip: _skip}));
            break;

        default:
    }

    return true;

};




