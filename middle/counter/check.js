const dot = require('dotty');
const _   = require('underscore');

function CounterCheck(req, res, next) {

    const _app      = req.app;
    const _env      = _app.get('env');
    const _resp     = _app.system.response.app;
    const _schema   = _app.lib.schema;
    const _helper   = _app.lib.utils.helper;
    const _mongoose = _app.core.mongo.mongoose;
    const _user     = req.__user;
    const _errType  = 'CounterApiError';
    const _middle   = 'middle.counter.check';

    // set schema
    const schema = new _schema(req.params.object).init(req, res, next);

    // get params
    const id    = req.params.id;
    const field = req.params.field;
    const type  = req.params.type || 'incr';
    const alias = Object.keys(schema._alias);

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
    const props = dot.get(schema._save, `properties.${short}`);
    const ftype = props.ftype;
    let mask    = schema._mask || {};
    const Item  = schema._model;

    // check masking
    if(_app.lib.utils) {
        let _maskName;
        if(type == 'incr')
            _maskName = 'increment';
        if(type == 'decr')
            _maskName = 'decrement';
        
        mask = mask[_maskName] || {};
        let mObj = {};
        mObj[field] = type;
        mObj = _helper.mask(mObj, mask);

        if( ! mObj ) {
            return next( _resp.UnprocessableEntity({
                middleware: _middle,
                type: _errType,
                errors: ['field mask is activated']
            }));
        }
    }

    // set counter object
    req.__counterAcl = {
        id,
        field,
        type,
        short
    };

    next(); 
}

module.exports = app => CounterCheck;