const kue = require('kue');

module.exports = app => {

    // mount ui
    app.use('/admin/kue', kue.app);
    return true;

};







