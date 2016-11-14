const dot = require('dotty');

function DataBodyUserid(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _schema = _app.lib.schema;
    const _userId = req.body.user_id;
    const _middle = 'middle.data.body.userid';
    
    if( ! _userId || _userId === '' ) {
        return next( _resp.Unauthorized({
            type: 'InvalidCredentials',
            errors: ['user id not found']
        }));
    }
    
    new _schema('system.users').init(req, res, next).getById(_userId, (err, doc) => {
        if( err || ! doc ) {
            return next( _resp.Unauthorized({
                middleware: _middle,
                type: 'InvalidCredentials',
                errors: ['user data not found']}
            ));
        }
        
        req.__bodyUser     = doc;
        req.__bodyUser._id = doc._id.toString();
        
        next();
    });

}

module.exports = app => DataBodyUserid;