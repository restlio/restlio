const dot = require('dotty');

function EntityMiddleware(req, res, next) {
    const _app     = req.app;
    const _mdl     = _app.middle;
    const _resp    = _app.system.response.app;
    const _field   = req.params.field;
    const _entity  = req.__entityAcl;
    const _errType = 'EntityApiError';
    const _middle  = 'middle.entity.middleware';
    
    if( ! _entity.acl ) return next();
    
    // check acl middleware
    const _slug = req.__appData.slug;
    const _Func = dot.get(_mdl, `${_slug}.entity.${_field}`);
   
    if( ! _Func ) {
        return next( _resp.NotFound({
            middleware: _middle,
            type: _errType,
            errors: ['entity middleware not found'],
        }));
    }

    // load acl middleware
    new _Func(req, res, next);
}

module.exports = () => EntityMiddleware;
