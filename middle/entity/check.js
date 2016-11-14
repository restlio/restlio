const dot = require('dotty');
const _   = require('underscore');

function EntityCheck(req, res, next) {

    const _app      = req.app;
    const _env      = _app.get('env');
    const _resp     = _app.system.response.app;
    const _schema   = _app.lib.schema;
    const _helper   = _app.lib.utils.helper;
    const _mongoose = _app.core.mongo.mongoose;
    const _user     = req.__user;
    const _errType  = 'EntityApiError';
    const _middle   = 'middle.entity.check';
    
    // check user id
    if( ! _user || ! _user.id || _user.id == 'guest')
        return next( _resp.Forbidden() );

    // set schema
    const schema = new _schema(req.params.object).init(req, res, next);
    
    // get params
    const id     = req.params.id;
    const field  = req.params.field;
    let fieldVal = req.params.field_val;
    const alias  = Object.keys(schema._alias);

    // check field of schema
    if( ! alias.includes(field) ) {
        return next( _resp.NotFound({
            middleware: _middle,
            type: _errType,
            errors: ['field not found']
        }));
    }

    // get schema properties
    const short = schema._alias[field];
    const ref   = schema._refs[short];
    const slug  = req.__appData.slug;
    const props = dot.get(schema._save, `properties.${short}`);
    const type  = props.type;
    const pair  = props.pair;
    const flex  = props.flex_ref;
    const acl   = props.entity_acl;
    let mask    = schema._mask || {};
    const Item  = schema._model;

    // pair'i varsa tekli item üzerinde işlem yapıyoruz
    if(fieldVal && fieldVal.includes('|') && type == 'array' && ! pair)
        fieldVal = fieldVal.split('|');
    
    // set value
    let setVal;

    // eğer flexible reference ise user id veya profile id'ye zorlamıyoruz
    if(flex)
        setVal = fieldVal;
    if(ref == 'system_users')
        setVal = _user.id;
    else if(ref == `${slug}_profiles`)
        setVal = _user.profile;
    else
        setVal = fieldVal;

    // eğer setVal yoksa hata dönüyoruz
    if( ! setVal ) {
        return next( _resp.NotFound({
            middleware: _middle,
            type: _errType,
            errors: ['field reference value not found']
        }));
    }

    // check masking
    if(_app.lib.utils) {
        mask = mask.entity || {};
        let mObj = {};
        mObj[field] = setVal;
        mObj = _helper.mask(mObj, mask);

        if( ! mObj ) {
            return next( _resp.UnprocessableEntity({
                middleware: _middle,
                type: _errType,
                errors: ['field mask is activated']
            }));
        }
    }

    const setValArr = _.uniq( (_helper.type(setVal) == '[object Array]') ? setVal : [setVal] );
    
    // set entity object
    req.__entityAcl = {
        id,
        type,
        setVal,
        setValArr,
        short,
        acl,
        pair: schema._alias[pair],
        actor: _user
    };

    // check valid
    if(ref && fieldVal) {
        _mongoose.model(props.ref).count({_id: {$in: setValArr}}, (err, count) => {
            if( err || count != setValArr.length ) {
                return next( _resp.NotFound({
                    middleware: _middle,
                    type: _errType,
                    errors: ['non existing field reference']
                }));
            }

            /**
             * @TODO
             *
             * reference owner'lığı da set edilebilsin, örneğin comment eklendi ve modele comment array'i basılacak,
             * burada count yerine owner id ile birlikte data alınabilir
             */

            next();
        });
    }
    else
        next();
}

module.exports = app => EntityCheck;