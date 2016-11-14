const dot = require('dotty');

function Access(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _auth   = _app.config[_env].auth; // auth config
    const _path   = req.path;
    const _slug   = req.__appData.slug;
    const _middle = 'middle.access';
    
    // check endpoint status
    const access = dot.get(_auth, `${_slug}.${_path}`);

    if(_auth && _auth[_slug] && ! access ) {
        return next( _resp.Unauthorized({
            middleware: _middle,    
            type: 'InvalidCredentials',
            errors: ['endpoint not allowed']}
        ));
    }

    next();

}

module.exports = app => Access;