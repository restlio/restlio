function DataBodyUserid(req, res, next) {
    const _helper = req.app.lib.utils.helper;
    const _schema = req.app.lib.schema;
    const _userId = req.body.user_id;
    const _middle = 'middle.data.body.userid';
    
    if( ! _userId || _userId === '' ) {
        return _helper.middle(next, _middle, 'user id not found');
    }
    
    new _schema('system.users').init(req, res, next).getById(_userId, (err, doc) => {
        if( err || ! doc ) {
            return _helper.middle(next, _middle, 'user data not found');
        }
        
        req.__bodyUser     = doc;
        req.__bodyUser._id = doc._id.toString();
        next();
    });
}

module.exports = () => DataBodyUserid;
