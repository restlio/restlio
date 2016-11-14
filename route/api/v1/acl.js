const async = require('async');
const _     = require('underscore');

module.exports = app => {

    const _mdl = app.middle;

    app.get('/api/resources',
        _mdl.api,
        _mdl.auth, 
    (req, res, next) => {

        app.acl.userRoles(req.__user.id, (err, roles) => {
            app.acl.whatResources(roles, (err, resources) => {
                res.json({roles, data: resources});
            });
        });

    });

};