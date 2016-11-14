const dot = require('dotty');

function DefaultRoleInvite(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _schema = _app.lib.schema;
    const _slug   = req.__appData.slug;
    const _middle = 'middle.default.role.invite';
    
    const role = dot.get(_app.config[_env], `roles.${_slug}.initial.invite`);

    if ( ! role ) {
        return next(_resp.Unauthorized({
            middleware: _middle,
            type: 'InvalidCredentials',
            errors: ['initial role config not found (invite)']
        }));
    }

    // get role by slug
    new _schema('system.roles').init(req, res, next).get({
        apps: req.__appId,
        slug: role,
        qt: 'one'
    }, (err, role) => {
        if ( err || ! role ) {
            return next(_resp.Unauthorized({
                middleware: _middle,
                type: 'InvalidCredentials',
                errors: ['initial role not found (invite)']
            }));
        }

        req.__defaultRole = role._id.toString(),

        next();
    });

}

module.exports = app => DefaultRoleInvite;