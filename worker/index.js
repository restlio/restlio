const debug = require('debug');

module.exports = app => {
    const mongoose = app.core.mongo.mongoose;
    const log = debug('RESTLIO:WORKER:DENORMALIZE');

    if( ! app.boot.kue ) {
        return log('kue not found');
    }

    app.boot.kue.process('denormalize-document', 1, (job, done) => {
        const params = job.data.params;
        const Model = mongoose.model(params.model);

        Model.findOne({_id: params.id}, (err, doc) => {
            if(err) {
                log(`[${params.model}] %o`, err);
                return done();
            }
            
            log(`[${params.model}] %s`, doc._id.toString());
            doc.save(err => {
                if(err) log(`[${params.model}] %o`, err);
                return done();
            });

            return false;
        });
    });

    app.boot.kue.process('randomize-document', 1, (job, done) => {
        const params = job.data.params;
        const Model = mongoose.model(params.model);

        Model.findOne({_id: params.id}, (err, doc) => {
            log(`[${params.model}] %s`, doc._id);
            doc.r = Math.random();
            doc.save(err => {
                if(err) log(`[${params.model}] %o`, err);
                done();
            });
        });
    });

    return false;
};
