const compress = require('compression');

module.exports = app => {

    app.use(compress());
    return true;

};




