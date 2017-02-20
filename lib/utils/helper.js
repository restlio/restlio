const crypto = require('crypto');
const mask = require('json-mask');
const jwt = require('jwt-simple');
const dot = require('dotty');
const _ = require('underscore');

// speed up calls
const toString = Object.prototype.toString;

class Helper {

    constructor(app) {
        this._app = app;

        // slugs for validation messages
        this._slugs = {
            required: 'required_error',
            email: 'email_error',
        };

        String.prototype.trToUpper = function trToUpper() {
            let string = this;
            const letters = {i: 'İ', ş: 'Ş', ğ: 'Ğ', ü: 'Ü', ö: 'Ö', ç: 'Ç', ı: 'I'};
            string = string.replace(/(([iışğüçö]))/g, letter => letters[letter]);
            return string.toUpperCase();
        };

        String.prototype.trToLower = function trToLower() {
            let string = this;
            const letters = {İ: 'i', I: 'ı', Ş: 'ş', Ğ: 'ğ', Ü: 'ü', Ö: 'ö', Ç: 'ç'};
            string = string.replace(/(([İIŞĞÜÇÖ]))/g, letter => letters[letter]);
            return string.toLowerCase();
        };

        String.prototype.trTitleize = function trTitleize() {
            const words = this.split(' ');
            const array = [];
            for (let i = 0; i < words.length; ++i) {
                array.push(words[i].charAt(0).trToUpper() + words[i].toLowerCase().slice(1));
            }
            return array.join(' ');
        };

        // set time vars
        this._time = {
            minute   : 60,
            minuteMs : 60 * 1000,
            hour     : 60 * 60,
            hourMs   : 60 * 60 * 1000,
            day      : 24 * 60 * 60,
            dayMs    : 24 * 60 * 60 * 1000,
        };
    }

    type(value) {
        return toString.call(value);
    }

    hash(passwd, salt) {
        return crypto.createHmac('sha256', salt).update(passwd).digest('hex');
    }

    random(len) {
        // return required number of characters
        return crypto.randomBytes(Math.ceil(len / 2))
            .toString('hex') // convert to hexadecimal format
            .slice(0, len);
    }

    clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    mapToString(value) {
        return _.map(value, obj => obj.toString());
    }

    expiresIn(numDays) {
        const date = new Date();
        return date.setDate(date.getDate() + numDays);
    }

    genToken(user, secret, days) {
        const expires = this.expiresIn(days);
        const token = jwt.encode({exp: expires, user}, secret);
        return {token, expires};
    }

    daysLater(numDays) {
        return Date.now() + (3600000 * 24 * numDays);
    }

    mask(obj, fields) {
        return mask(obj, fields);
    }

    schemaAliases(schema) {
        schema = _.clone(schema);
        schema = _.map(schema, (value) => value.alias || value[0].alias);

        // prepend _id field
        schema.unshift('_id');
        
        return schema;
    }

    bodyErrors(errors, next) {
        const self = this;
        this._http = this._app.system.response ? this._app.system.response.app : false;

        const resp = {
            type: 'ValidationError',
            errors: [],
        };

        _.each(errors, (value, key) => {
            if(self.type(value === '[object Array]')) {
                _.each(value, (v) => {
                    resp.errors.push({path: key, slug: v});
                });
            } else {
                resp.errors.push({path: key, slug: value});
            }
        });

        return (next && this._http) ? next(this._http.UnprocessableEntity(resp)) : resp.errors;
    }

    middle(next, middleware, errors) {
        this._http = this._app.system.response ? this._app.system.response.app : false;

        return next( this._http.Unauthorized({
            middleware,
            errors,
            type: 'InvalidCredentials',
        }) );
    }

    bootConf(name) {
        const _env = this._app.get('env');
        const _name = this._app.get('name');
        const _appC = dot.get(this._app.config, [_env, _name, 'boot', name].join('.'));
        const _defC = dot.get(this._app.config, [_env, 'boot', name].join('.'));
        return _appC || _defC;
    }

    isEmpty(mixedVar) {
        let undef;
        let key;
        let i;
        let len;
        const emptyValues = [undef, null, false, 0, '', '0'];

        for (i = 0, len = emptyValues.length; i < len; i++) {
            if (mixedVar === emptyValues[i]) {
                return true;
            }
        }

        if (typeof mixedVar === 'object') {
            for(key in mixedVar) {
                if (mixedVar.hasOwnProperty(key)) {
                    return false;
                }
            }
            return true;
        }

        return false;
    }

    isEmptyAny(mixedArr) {
        return _.some(mixedArr, v => {
            if(this.isEmpty(v)) return true;
        });
    }

}

module.exports = app => new Helper(app);
