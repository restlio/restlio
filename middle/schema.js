function Schema(name) {
    return (req, res, next) => {
        const _app    = req.app;
        const _env    = _app.get('env');
        const _schema = _app.lib.schema;
        const _slug   = name.replace('.', '_');
            
        if( ! req.__m ) req.__m = {};
        req.__m[_slug] = new _schema(name).init(req, res, next);
        
        next();
    };
}

module.exports = () => Schema;
