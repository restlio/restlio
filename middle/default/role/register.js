const dot = require('dotty');

function DefaultRoleRegister(req, res, next) {
    const _env    = req.app.get('env');
    const _helper = req.app.lib.utils.helper;
    const _schema = req.app.lib.schema;
    const _slug   = req.__appData.slug;
    const _middle = 'middle.default.role.register';
    
    const role = dot.get(req.app.config[_env], `roles.${_slug}.initial.register`);

    if ( ! role ) {
        return _helper.middle(next, _middle, 'initial role config not found (register)');
    }

    // get role by slug
    new _schema('system.roles').init(req, res, next).get({
        apps: req.__appId,
        slug: role,
        qt: 'one',
    }, (err, role) => {
        if ( err || ! role ) {
            return _helper.middle(next, _middle, 'initial role not found (register)');
        }

        req.__defaultRole = role._id.toString();
        next();
    });
}

module.exports = () => DefaultRoleRegister;
