const cookie = require('cookie-parser');

module.exports = app => {

    app.use(cookie());
    return true;

};




