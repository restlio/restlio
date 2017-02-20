const stampede = require('cache-stampede');

module.exports = app => stampede.redis(app.core.redis.a);
