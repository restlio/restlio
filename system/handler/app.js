function log(app, err, req, res) {
    const helper = app.lib.utils.helper;
    const users = req.__user ? req.__user.id : undefined;
    err.users = users;

    if(users === 'guest') {
        err.users = undefined;
        err.users_role = 'guest';
    }

    if(res.__api || res.__json) {
        err.source = 'api';
    }

    helper.log('error', err);
}

function error(err, req, res, next) {
    const app = req.app;
    const api = res.__api || res.__json;

    // error
    const {name = 'InternalServerError', code = 500, message, type} = err;
    const response = {
        meta: {name, code},
    };

    if(message) {
        response.meta.message = message;
    }

    if(type) {
        response.meta.type = type;
    }

    if( ! api && code === 500) {
        log(app, err, req, res);
        return res.status(500).render('admin/error/500');
    } else if( ! api && code === 404 ) {
        return res.status(404).render('admin/error/404');
    }

    if(code !== 404) {
        log(app, err, req, res);
    }
    
    return res.status(code).json(response);
}

function notFound(req, res, next) {
    next(req.app.system.response.app.NotFound());
}

module.exports = app => {
    app.all('*', notFound);
    app.use(error);
    return true;
};
