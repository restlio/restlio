module.exports = app => {

    if(parseInt(process.env.worker_id) !== 0)
        return false;

    const _env    = app.get('env');
    const _conf   = app.config[_env].feed;
    const _schema = app.lib.schema;
    const _log    = app.lib.logger;
    const _kue    = app.boot.kue;
    const _group  = 'WORKER:CRON:FEEDS';
    
    if( ! _conf )
        return _log.info(_group, 'feed config not found');
    
    if( ! _conf.enabled )
        return _log.info(_group, 'feed config is not enabled');
    
    new app.boot.cron(_conf.cron.interval, () => {

        new _schema('feed.channels').init(app).stream({}, (err, stream) => {

            stream.on('data', doc => {

                const docId = doc._id.toString();
                 _log.info(_group, `denormalize job, ${docId}`);

                 _kue.create('feed-channel-parse', {
                    title: 'Feed channel parse',
                    params: {
                        type: 'feed-channel-parse',
                        channel: docId
                    }
                 }).attempts(3).removeOnComplete(true).save();

            }).on('error', err => {
                _log.error(_group, err);
            }).on('close', () => {
                _log.info(_group, 'stream finished');
            });

        });
        
    }, null, true); // start: true

};

