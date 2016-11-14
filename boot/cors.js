const cors = require('cors');

module.exports = app => {

    app.use(cors());
    app.options('*', cors());

    return true;
    
};





