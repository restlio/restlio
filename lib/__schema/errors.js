const dot = require('dotty');
const _ = require('underscore');

// errors ile üretilen hatayı callback ile aldıktan sonra
// http response vermek istersek bunu kullanacağız
exports.errResponse = function errResponse(err) {
    switch(err.type) {
        case 'ValidationError':
            this._next(this._http.UnprocessableEntity(err));
            break;

        case 'NotFound':
            this._next(this._http.NotFound());
            break;

        default:
            this._next(this._http.InternalServerError(err));
            break;
    }
};

exports.errors = function errors(err, cb) {
    const resp = {
        type : 'SystemError',
    };

    this._log.error(this._group, err);
    const _name = err.name;

    if(_name === 'ValidationError') {
        resp.type = 'ValidationError';
        resp.errors = [];

        _.each(err.errors, (field) => {
            const message = field.message;
            let slug;

            if(message === 'is missing and not optional') slug = 'required_error';
            else if(message.includes('must have at least key')) slug = 'some_keys_error';
            else if(message.includes('must match')) slug = 'pattern_error';
            else if(message.includes('must be longer than')) slug = 'min_length_error';
            else if(message.includes('must be shorter than')) slug = 'max_length_error';
            else if(message.includes('must have exactly')) slug = 'exact_length_error';
            else if(message.includes('must be less than')) slug = 'lower_than_error';
            else if(message.includes('must be less than or equal to')) slug = 'lower_than_equal_error';
            else if(message.includes('must be greater than')) slug = 'greater_than_error';
            else if(message.includes('must be greater than or equal to')) slug = 'greater_than_equal_error';
            else if(message.includes('must be equal to')) slug = 'equal_error';
            else if(message.includes('must not be equal to')) slug = 'not_equal_error';
            else if(message.includes('must have at least key')) slug = 'need_some_fields_error';

            resp.errors.push({
                message,
                path: field.code || field.property || field.path,
                slug: dot.get(field, 'properties.kind') || slug,
            });
        });

        return cb ? cb(resp) : this._next(this._http.UnprocessableEntity(resp));
    } else if(_name === 'NotFound') {
        resp.type = 'NotFound';
        return cb ? cb(resp) : this._next(this._http.NotFound());
    } else if(_name === 'MongoError') {
        let message = err.message;
        if(err.code === 11000) message = 'unique_error';
        resp.type = 'MongoError';
        resp.errors = [];
        resp.errors.push({code: err.code, message, slug: message});
    } else if(_name === 'CastError') {
        resp.type = 'CastError';
        resp.errors = [];
        resp.errors.push({path: err.path, message: err.message});
    } else if(_name === 'ParserError') {
        resp.type = 'ParserError';
        resp.errors = [];
        resp.errors.push({message: err.message});
    } else if(
        _name === 'SchemaError' ||
        _name === 'QueryParserError' ||
        _name === 'NotSupportedQueryType'
    ) {
        resp.type = err.name;
    }

    return cb ? cb(resp) : this._next(this._http.InternalServerError(resp));
};
