const short = require('short');

module.exports = app => {

    short.run(app.core.mongo.mongoose);
    return short;

};




