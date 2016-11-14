const kue = require('kue');

module.exports = app => {

    const _env      = app.get('env');
    const _log      = app.lib.logger;
    const _schema   = app.lib.schema;
    const _jobs     = app.boot.kue;
    const _group    = 'WORKER:FEEDS';

    if( ! app.boot.kue ) {
        _log.info(_group, 'kue not found');
        return false;
    }

    app.boot.kue.process('feed-channel-parse', 1, (job, done) => {

        const params = job.data.params;
        new app.lib.feedparser(app).run(params.channel, done);

    });

};

