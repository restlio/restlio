const kue = require('kue');

module.exports = app => {

    const _env      = app.get('env');
    const _log      = app.lib.logger;
    const _schema   = app.lib.schema;
    const _jobs     = app.boot.kue;
    const _mongoose = app.core.mongo.mongoose;
    const _group    = 'WORKER:DENORMALIZE';

    if( ! app.boot.kue ) {
        _log.info(_group, 'kue not found');
        return false;
    }

    app.boot.kue.process('denormalize-document', 1, (job, done) => {

        const params = job.data.params;
        const Model  = _mongoose.model(params.model);

        Model.findOne({_id: params.id}, (err, doc) => {
            if(err) {
                _log.error(`${_group}:${params.model}`, err);
                return done();
            }
            
            _log.info(`${_group}:${params.model}`, doc._id.toString());

            doc.save(err => {
                if(err) {
                    _log.error(_group, err);
                    return done();
                }

                done();
            });
        });

    });

};

