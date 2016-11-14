function Api(req, res, next) {
    res.__api = true;
    next();
}

module.exports = app => Api;