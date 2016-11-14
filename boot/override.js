const override = require('method-override');

module.exports = app => {

    app.use(override('X-HTTP-Method-Override'));
    return true;

};




