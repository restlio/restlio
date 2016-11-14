const dot = require('dotty');
const _   = require('underscore');

function ObjectData(object, param) {

    return (req, res, next) => {
        const _app    = req.app;
        const _env    = _app.get('env');
        const _schema = _app.lib.schema;
        let _object   = object.replace('.', '_');

        _object = req.__m[_object] || new _schema(object).init(req, res, next);

        _object.getById(dot.get(req, param), (err, doc) => {

            req.__object = doc;
            
            if(doc)
                req.__object._id = doc._id.toString();
            
            next();
            
        });
    };

}

module.exports = app => ObjectData;