const flash = require('connect-flash');

module.exports = app => {

    app.use(flash());
    return true;

};




