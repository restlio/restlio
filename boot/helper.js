const extras = require('swig-extras');
const moment = require('moment');
const momentTz = require('moment-timezone');
const _s = require('underscore.string');
const _ = require('lodash');

function lodashHas(funcName, string) {
    const obj = string ? _s : _;
    return (obj[funcName] && typeof obj[funcName] === 'function');
}

function useLodash(swig, filter, string) {
    const obj = string ? _s : _;
    
    if (filter === undefined) {
        return Object.keys(obj).forEach(action => {
            if (lodashHas(action, string)) {
                useLodash(swig, action, string);
            }
        });
    }

    if (Array.isArray(filter)) {
        return filter.forEach(f => useLodash(swig, f, string));
    }
        
    if (lodashHas(filter, string)) {
        swig.setFilter((string ? 's_' : 'l_') + filter, obj[filter]);
    }

    return true;
}

exports.view = (swig) => {
    useLodash(swig);
    useLodash(swig, undefined, true);

    // swig extra filters
    extras.useFilter(swig, 'split');

    swig.setFilter('dateFormat', (element, format, timezone, locale) => {
        if(locale) {
            moment.locale(locale);
        }
        
        let parsed;
        if(format === 'fromNow') {
            parsed = moment(element).fromNow();
        } else if(timezone && timezone !== '') {
            parsed = momentTz.tz(new Date(element), timezone).format(format);
        } else {
            parsed = moment(new Date(element)).format(format);
        }
        
        if(parsed === 'Invalid date') {
            return element;
        }

        return parsed;
    });

    swig.setFilter('trToUpper', string => string.trToUpper());

    swig.setFilter('numberFormat', (number, decimals = 0, decimalSpr = '.', orderSpr = ',') => {
        _s.numberFormat(parseInt(number, 10), decimals, decimalSpr, orderSpr);
    });

    return true;
};
