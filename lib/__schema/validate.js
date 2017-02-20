const inspector = require('schema-inspector');

// TODO: log'ları burada debug ile kullan (kendi özel prefix'leri ile)
function Validate(schema, obj, cb) {
    const self = this;
    // console.log(obj);
    // console.log(schema.properties.$set);

    // TODO:
    // default value sahibi olan property'lerde optional = true bile olsa default value ekliyor
    // update durumunda sıkıntı olur, update objesinden def silinebilir

    // sanitize
    inspector.sanitize(schema, obj, self._sanitize, (err, result) => {
        // console.log('[Schema sanitize:obj]');
        // console.log(obj);

        // validate
        inspector.validate(schema, obj, self._validate, (err2, result2) => {
            // console.log('[Schema validate:obj]');
            // console.log(obj);
            // console.log('[Schema validate:result]');
            // console.log(result);

            cb(err2, result2);
        });
    });
}

module.exports = Validate;
