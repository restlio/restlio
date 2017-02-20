const dot = require('dotty');

function DefaultRoleInvite(req, res, next) {
    const _env    = req.app.get('env');
    const _helper = req.app.lib.utils.helper;
    const _schema = req.app.lib.schema;
    const _slug   = req.__appData.slug;
    const _middle = 'middle.default.role.invite';
    
    const role = dot.get(req.app.config[_env], `roles.${_slug}.initial.invite`);

    if ( ! role ) {
        return _helper.middle(next, _middle, 'initial role config not found (invite)');
    }

    // get role by slug
    new _schema('system.roles').init(req, res, next).get({
        apps: req.__appId,
        slug: role,
        qt: 'one',
    }, (err, role) => {
        if ( err || ! role ) {
            return _helper.middle(next, _middle, 'initial role not found (invite)');
        }

        req.__defaultRole = role._id.toString();
        next();
    });
}

module.exports = () => DefaultRoleInvite;
