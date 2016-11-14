const dot = require('dotty');
const _   = require('underscore');

function UserAcl(object, perm) {
    let slug = object.replace('.', '_');
    
    return (req, res, next) => {
        const _app    = req.app;
        const _env    = _app.get('env');
        const _resp   = _app.system.response.app;
        const _helper = _app.lib.utils.helper;
        const _middle = 'middle.user.acl';
        
        _app.acl.allowedPermissions(req.__user.id, slug, (err, results) => {
            let perms = dot.get(results, slug);

            if( err || ! perms ) {
                return next( _resp.Unauthorized({
                    middleware: _middle,
                    type: 'InvalidCredentials',
                    errors: ['not found acl perms']}
                ));
            }
            else if( ! perms.length ) {
                return next( _resp.Unauthorized({
                    middleware: _middle,
                    type: 'InvalidCredentials',
                    errors: ['not found acl perms']}
                ));
            }
            
            if(perm) {
                if(!perms.includes(perm)) {
                    return next( _resp.Unauthorized({
                        middleware: _middle,
                        type: 'InvalidCredentials',
                        errors: ['not allowed acl perms']}
                    ));
                }
            }
            
            perms = slug = null;
            
            next();
        });
        
    };

}

module.exports = app => UserAcl;