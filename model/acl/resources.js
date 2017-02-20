module.exports = app => {
    const _mongoose = app.core.mongo.mongoose;

    const Schema = {
        _bucketname : {type: String, index: 1},
        key         : {type: String, index: 1},
    };

    const ResourceSchema = app.core.mongo.db.Schema(Schema);

    return _mongoose.model('Acl_Resources', ResourceSchema);
};
