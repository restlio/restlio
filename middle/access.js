const dot = require('dotty');

function Access(req, res, next) {
    const _env    = req.app.get('env');
    const _helper = req.app.lib.utils.helper;
    const _auth   = req.app.config[_env].auth; // auth config
    const _path   = req.path;
    const _slug   = req.__appData.slug;
    const _middle = 'middle.access';
    
    // check endpoint status
    const access = dot.get(_auth, `${_slug}.${_path}`);

    if(_auth && _auth[_slug] && ! access ) {
        return _helper.middle(next, _middle, 'endpoint not allowed');
    }

    next();
}

module.exports = () => Access;
