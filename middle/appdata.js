function AppData(req, res, next) {
    const _helper = req.app.lib.utils.helper;
    const _schema = req.app.lib.schema;
    const _middle = 'middle.appdata';
    
    if( ! req.__appId ) {
        return _helper.middle(next, _middle, 'app id not found');
    }

    new _schema('system.apps').init(req, res, next).getById(req.__appId, (err, doc) => {
        if( ! doc ) {
            return _helper.middle(next, _middle, 'app not found');
        }

        req.__appData = doc;
        req.__appData._id = doc._id.toString();
        next();
    });
}

module.exports = () => AppData;
