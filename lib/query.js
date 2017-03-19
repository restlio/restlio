const async = require('async');
const dot = require('dotty');
const php = require('phpjs');
const mongoose = require('mongoose');
const _ = require('underscore');

/**

 reserved query parameters:
 qt : query type (find|one|count|findcount|distinct|tree)
 f  : fields
 s  : sort
 sk : skip
 l  : limit
 p  : populate

 ?qt=<qtype>&f=<fields>&s=<sort>&sk=<skip>&l=<limit>&p=<populate>

 get conditions:

 key={gt}a
 key is greater than a

 key={gte}a
 key is greater or equal than a

 key={lt}a
 key is lower than a

 key={lte}a
 key is lower or equal than a

 key={in}a,b
 at least one of these is in array

 key={nin}a,b
 any of these values is not in array

 key={ne}a
 key is not equal to a

 key={all}a,b
 all of these contains in array

 key={empty}
 field is empty or not exists

 key={!empty}
 field exists and is not empty

 key={null}
 field exists and is null

 key={near}longitude,latitude,maxDistance
 docs near key

 key={:like:}a
 %like% query

 key={like:}a
 like% query

 key={:like}a
 %like query

 key={between}a,b
 docs between values

 {or|b}key1={in}a,b&{or|b}key2=c
 or query (b: 'or' group alias)

 key1=N|{empty}
 or query for same key

 aggregation keys:
 _count_distinct=key
 _group_by_day=key
 _group_by=key

 */

// speed up calls
const hasOwn = Object.prototype.hasOwnProperty;
const toString = Object.prototype.toString;

const parse = (query, model) => {
    try {
        // collect aliases from paths
        let paths = model.schema.paths;
        let alias = {};
        const types = {};

        _.each(paths, (path, key) => {
            if (key === 'parentId') {
                alias.parentId = 'parentId';
                types.parentId = 'objectid';
            } else if (dot.get(path, 'options.alias')) {
                alias[path.options.alias] = key;
                types[path.options.alias] = path.options.type.name.toLowerCase();
            } else if (dot.get(path, 'caster.options.alias')) {
                alias[path.caster.options.alias] = key;
                types[path.caster.options.alias] = path.caster.instance.toLowerCase();
            }
        });

        // query object
        const qy = {
            q  : {}, // query
            qt : 'find', // query type
            f  : false, // fields
            s  : false, // sort
            sk : false, // skip
            l  : false, // limit
            p  : false, // populate
            pp : [], // pipe
            at : false, // aggregation type
            ao : {}, // aggregation operators
        };

        let toBoolean = str => {
            const lower = (typeof str === 'string') ? str.toLowerCase() : str;

            if (lower === 'true' || lower === 'yes') return true;
            else if (lower === 'false' || lower === 'no') return false;
            return -1;
        };

        const getOperator = val => {
            let operator = false;
            if (typeof val === 'string') {
                operator = val.match(/\{(.*)\}/);
                val = val.replace(/\{(.*)\}/, '');
                if (operator) {
                    operator = operator[1];
                }
            }
            return {operator, val};
        };

        let condition = (key, cond) => {
            let operator = false;
            if (typeof key === 'string') {
                operator = key.match(/\{(.*)\}/);
                key = key.replace(/\{(.*)\}/, '');
                if (operator) {
                    operator = operator[1];
                }
            }

            // change with alias
            if (alias[key]) {
                key = alias[key];
            }

            let opKey;
            let arr;
            if (operator && operator.includes('|')) {
                arr = operator.split('|');
                operator = arr[0];
                opKey = arr[1];
            } else {
                opKey = 'a';
            }

            if (operator && ['or', 'nor'].includes(operator)) {
                or(opKey, key, cond, operator === 'nor');
            } else {
                qy.q[key] = cond;
            }
        };

        let orObj = {};
        let norObj = {};

        let or = (container, key, cond, nor) => {
            const obj = nor ? norObj : orObj;

            if ( ! hasOwn.call(obj, container) ) {
                obj[container] = [];
            }

            const condition = {};
            condition[key] = cond;
            obj[container].push(condition);
        };

        let parseOr = nor => {
            const obj = nor ? norObj : orObj;
            const op = nor ? '$nor' : '$or';
            const arr = [];

            for (const o in obj) {
                if (hasOwn.call(obj, o)) {
                    arr.push(obj[o]);
                }
            }

            const len = arr.length;

            if (len === 1) {
                qy.q[op] = arr[0];
            } else if (len > 1) {
                qy.q.$and = [];
                for (const a in arr) {
                    if (hasOwn.call(arr, a)) {
                        const curr = {};
                        curr[op] = arr[a];
                        qy.q.$and.push(curr);
                    }
                }
            }
        };

        let parts = parts => {
            if (typeof parts !== 'string') {
                return parts;
            }

            parts = parts.split(',');

            for (const p in parts) {
                if (hasOwn.call(parts, p)) {
                    let part = parts[p];
                    const prefix = (part[0] === '-');
                    part = prefix ? part.substring(1) : part;

                    if (alias[part]) {
                        parts[p] = (prefix ? '-' : '') + alias[part];
                    }
                }
            }

            return parts.join(' ');
        };

        let param = (key, val) => {
            let lcKey = key;

            // prevent $ characters
            if (key[0] === '$') {
                return;
            }

            // eğer value içinde pipe işareti varsa aynı key için or'luyoruz
            if (typeof val !== 'undefined' && types[lcKey] !== 'number' && toString.call(val) === '[object String]' && val.includes('|')) {
                const valArr = val.split('|');

                _.each(valArr, (oVal) => {
                    // eğer key zaten bir or grubuna dahil edilmişse key olarak direkt key'in kendisini seçiyoruz
                    if (key.includes('{or}') || key.includes('or|')) {
                        param(key, oVal);
                    } else {
                        param(`{or|${key}}${key}`, oVal);
                    }
                });

                return;
            }

            // parse aggregation
            if (lcKey === 'aggregate') {
                const agrVals = val.split(',');
                _.each(agrVals, agrVal => {
                    const opt = getOperator(agrVal);
                    param(opt.val, `{${opt.operator}}`);
                });
                return;
            }

            let operator = false;
            if (typeof val === 'string') {
                operator = val.match(/\{(.*)\}/);
                val = val.replace(/\{(.*)\}/, '');
                if (operator) {
                    operator = operator[1];
                }
            }

            // değer beklemeyen operatörler
            let paramOpts = ['empty', '!empty', 'null', 'sum', 'avg'];

            // sanitize number
            if (types[lcKey] === 'number') {
                val = parseInt(val, 10) || parseFloat(val);
            }

            // değer bekleyen operatörlerde boş değere izin verme (değeri 0 olanları sorgulamak isteyebiliriz)
            if ( ! paramOpts.includes(operator) && php.empty(val) && val !== 0 ) {
                return;
            }

            // change with alias
            if (alias[lcKey]) {
                if (types[lcKey]) {
                    types[alias[lcKey]] = types[lcKey];
                }

                lcKey = alias[lcKey];
            }

            let values = [];
            let bool = toBoolean(val);

            // aggregation vars
            const _project = { $project: {} };
            const _match = { $match: {} };
            const _sort = { $sort: {} };
            let _key;

            if (lcKey === 'fields') {
                qy.f = parts(val);
            }

            else if (lcKey === 'sort') {
                qy.s = parts(val);
            }

            else if (lcKey === 'populate') {
                qy.p = parts(val);
            }

            else if (lcKey === 'subpopulate') {
                qy.sp = val;
            }

            else if (['sum', 'avg'].includes(operator)) {
                const aoObj = {};
                aoObj[`$${operator}`] = `$${lcKey}`;
                qy.ao[`${operator}_${key}`] = aoObj;
            }

            else if (lcKey === '_count_distinct') {
                qy.qt = 'aggregate';
                qy.at = lcKey;
                _key = alias[val] || val;

                _match.$match[_key] = { $exists: true };

                qy.pp.push(_match);
                qy.pp.push({ $group: { _id: `$${_key}` } });
                qy.pp.push({ $group: { _id: 1, count: { $sum: 1 } } });
            }

            else if (lcKey === '_group_by_day') {
                qy.qt = 'aggregate';
                qy.at = lcKey;
                _key = alias[val] || val;

                _project.$project = { _id: 0, h: { $hour: `$${_key}` }, m: { $minute: `$${_key}` }, s: { $second: `$${_key}` }, ml: { $millisecond: `$${_key}` } };
                _project.$project[_key] = 1;
                qy.pp.push(_.clone(_project));

                _project.$project = { _id: 0 };
                _project.$project[_key] = {
                    $subtract: [`$${_key}`, { $add: ['$ml', { $multiply: ['$s', 1000] }, { $multiply: ['$m', 60, 1000] }, { $multiply: ['$h', 60, 60, 1000] }] }],
                };

                qy.pp.push(_.clone(_project));
                qy.pp.push({ $group: { _id: `$${_key}`, count: { $sum: 1 } } });
            }

            else if (lcKey === '_group_by') {
                qy.qt = 'aggregate';
                qy.at = lcKey;
                _key = alias[val] || val;

                _match.$match[_key] = { $exists: true };

                qy.pp.push(_match);
                qy.pp.push({ $group: { _id: `$${_key}`, count: { $sum: 1 } } });
            }

            else if (bool !== -1) {
                if (bool === false) {
                    or(lcKey, lcKey, bool); // or
                    or(lcKey, lcKey, { $exists: false }); // or
                } else {
                    condition(lcKey, bool);
                }
            }

            else if (['gt', 'gte', 'lt', 'lte'].includes(operator)) {
                // direkt date objesi geldiyse işlem yapma
                if (types[lcKey] === 'date' && typeof val !== 'object') {
                    val = new Date(val);
                }

                const obj = {};
                obj[`$${operator}`] = val;
                condition(lcKey, obj);
            }

            else if (operator === 'between') {
                values = val.split(',');

                // direkt date objesi geldiyse işlem yapma
                if (types[lcKey] === 'date' && typeof values[0] !== 'object' && typeof values[1] !== 'object') {
                    values[0] = new Date(values[0]);
                    values[1] = new Date(values[1]);
                }

                const bobj = {};
                bobj.$gte = values[0];
                bobj.$lt = values[1];

                condition(lcKey, bobj);
                // ----------------------------------------------------------------
            } else if (operator === 'in') {
                values = val.split(',');
                condition(lcKey, { $in: values });
            }

            else if (operator === 'nin') {
                values = val.split(',');
                condition(lcKey, { $nin: values });
            }

            else if (operator === 'ne') {
                condition(lcKey, { $ne: val });
            }

            else if (operator === 'all') {
                values = val.split(',');
                condition(lcKey, { $all: values });
            }

            else if (operator === 'empty') {
                // eğer key'in içinde pipe varsa başka bir or grubuna aittir
                if (lcKey.includes('{or}') || lcKey.includes('or|')) {
                    condition(lcKey, '');
                    condition(lcKey, { $exists: false });
                } else {
                    if (types[lcKey] === 'string') {
                        or(lcKey, lcKey, ''); // or
                    }

                    or(lcKey, lcKey, { $exists: false }); // or
                }
            }

            else if (operator === '!empty') {
                or(lcKey, lcKey, '', true); // nor
                or(lcKey, lcKey, { $exists: false }, true); // nor
            }

            else if (operator === 'null') {
                or(lcKey, lcKey, null);
            }

            else if (operator === 'near') {
                const locs = val.split(',');
                const dist = {
                    $nearSphere: [parseFloat(locs[0]), parseFloat(locs[1])],
                };

                // as kilometers
                if (typeof locs[2] !== 'undefined') {
                    dist.$maxDistance = parseFloat(locs[2]) / 6371;
                }

                condition(lcKey, dist);
            }

            else if (operator === ':like:') {
                try {
                    condition(lcKey, new RegExp(val, 'i'));
                } catch (e) {}
            }

            else if (operator === 'like:') {
                try {
                    condition(lcKey, new RegExp(`^${val}`, 'i'));
                } catch (e) {}
            }

            else if (operator === ':like') {
                try {
                    condition(lcKey, new RegExp(`${val}$`, 'i'));
                } catch (e) {}
            }

            else if (operator === 'null') {
                condition(lcKey, null);
            }
            
            else {
                condition(lcKey, val);
            }
                
            // TODO: other mongodb operators
            lcKey = operator = paramOpts = values = bool = null;
        };

        for (const key in query) {
            if ( ! hasOwn.call(query, key) ) {
                continue;
            }

            switch (key) {
                case ('qt'):
                case ('qtype'):
                    qy.qt = query[key];
                    break;

                case ('f'):
                case ('fields'):
                    param('fields', query[key]);
                    break;

                case ('s'):
                case ('sort'):
                    param('sort', query[key]);
                    break;

                case ('sk'):
                case ('skip'):
                    qy.sk = parseInt(query[key], 10);
                    break;

                case ('l'):
                case ('limit'):
                    qy.l = parseInt(query[key], 10);
                    break;

                case ('p'):
                case ('populate'):
                    param('populate', query[key]);
                    break;

                case ('sp'):
                case ('subpopulate'):
                    try {
                        const sp = JSON.parse(query[key]);
                        param('subpopulate', sp);
                    } catch (e) {}
                    break;

                case ('aggregate'):
                    if (query._group_by) {
                        param('aggregate', query[key]);
                    }
                    break;

                default:
                    param(key, query[key]);
                    break;
            }
        }

        parseOr(); // parse or
        parseOr(true); // parse nor

        paths = alias = orObj = norObj = null;
        toBoolean = condition = or = parseOr = parts = param = null;
        return qy;
    } catch (e) {
        console.log(e);
        return false;
    }
};

const keyParser = (input, type) => {
    if ((typeof input) !== 'string') {
        return false;
    }

    let neg = 0;
    if (type === 'sort') {
        neg = -1;
    }

    const output = {};
    const keys = input.split(',');

    for (const i in keys) {
        const key = keys[i];

        if (key.length > 1) {
            if (key[0] === '-') {
                output[key.substring(1)] = neg;
            } else {
                output[key] = 1;
            }
        } else {
            if (key.length === 0) {
                continue;
            }

            output[key] = 1;
        }
    }

    return output;
};

const doQuery = (query, model, opts, cb) => {
    const q = parse(query, model, opts);
    let m = model;

    if ( ! q ) {
        return cb({ name: 'QueryParserError' });
    }

    const notFound = { name: 'NotFound' };
    const notSupported = { name: 'NotSupportedQueryType' };
    const notFoundFields = { name: 'NotFoundFields' };

    // set default limit
    if ( ! q.l ) {
        q.l = 10;
    }

    // set maximum limit
    if (['find', 'findcount', 'randomfind', 'ids'].includes(q.qt) && q.l > 1000) {
        q.l = 1000;
    }

    // query type
    switch (q.qt) {
        case 'find':
            m = m.find(q.q);
            break;

        case 'ids':
            q.f = '_id';
            m = m.find(q.q);
            break;

        case 'stream':
            m = m.find(q.q);

            if (q.sk) m.skip(q.sk);
            if (q.l) m.limit(q.l);

            if (opts.lean) m.lean();

            // set batch size
            m.batchSize(500);

            cb(null, m.stream(), _.clone(q));
            break;

        case 'one':
            m = m.findOne(q.q);
            break;

        case 'count':
            model.count(q.q, (err, count) => {
                return err ? cb(err) : cb(err, { count }, _.clone(q));
            });

            return;

        case 'findcount':
            m = m.find(q.q);
            break;

        case 'tree':
            if (q.q.parentId && typeof model.GetChildren === 'function') {
                // check parent id (eğer parent id null gelirse materialized içinden hata atıyor - model.GetChildren)
                model.findOne({ _id: q.q.parentId }, (err, parent) => {
                    if ( ! parent ) {
                        return cb(notFound);
                    }

                    model.GetChildren(q.q.parentId, (err, children) => {
                        return err ? cb(err) : cb(err, model.ToArrayTree(children), _.clone(q));
                    });
                });
            } else if (typeof model.GetFullArrayTree === 'function') {
                model.GetFullArrayTree((err, tree) => {
                    return err ? cb(err) : cb(err, tree, _.clone(q));
                });
            } else {
                cb(notSupported);
            }

            return;

        case 'randomfind':
            if (typeof model.qRand === 'function') {
                q.q = model.qRand(q.q);
                m = m.find(q.q);
            } else {
                cb(notSupported);
            }

            break;

        case 'randomone':
            if (typeof model.qRand === 'function') {
                q.q = model.qRand(q.q);
                m = m.findOne(q.q);
            } else {
                cb(notSupported);
            }

            break;

        case 'distinct':
            if (q.f) {
                model.distinct(q.f, q.q, (err, doc) => {
                    cb(err, doc, _.clone(q));
                });
            } else {
                cb(notFoundFields);
            }

            return;

        case 'aggregate':
            _.each(q.q, (val, key) => {
                const path = model.schema.path(key);
                let instance = dot.get(path, 'caster.instance');
                if(instance) {
                    q.pp.unshift({ $unwind: `$${key}` });
                }

                instance = instance || path.instance;
                if (instance === 'ObjectID') {
                    // TODO: array şeklinde gelen $in ve $nin sorgularında da çalışabilmeli
                    q.q[key] = mongoose.Types.ObjectId(val);
                }
            });

            // add query filters to the beginning of the aggregation array
            if (Object.keys(q.q)) {
                q.pp.unshift({ $match: _.clone(q.q) });
            }

            if (q.at === '_group_by' && q.f) {
                let fields = keyParser(q.f);

                fields = _.mapObject(fields, (val, key) => ({
                    $first: `$${key}`,
                }));

                // copy fields to group object
                _.each(q.pp, (v, k) => {
                    if (v.$group) q.pp[k].$group = _.extend(q.pp[k].$group, fields);
                });
            }

            if (q.s) {
                q.pp.push({ $sort: keyParser(q.s, 'sort') });
            }

            if (q.sk) {
                q.pp.push({ $skip: q.sk });
            }

            if (q.l) {
                q.pp.push({ $limit: q.l });
            }
                
            // extend with aggregation operators
            if (Object.keys(q.ao).length > 0) {
                _.each(q.pp, (v, k) => {
                    if (v.$group) q.pp[k].$group = _.extend(q.pp[k].$group, q.ao);
                });
            }

            break;

        default:
            return cb(notSupported);
    }

    let qt = q.qt;

    if (['find', 'one', 'findcount', 'randomfind', 'randomone', 'ids'].includes(qt)) {
        if (q.s) m.sort(q.s);
        if (q.sk) m.skip(q.sk);
        if (q.l) m.limit(q.l);
        if (q.f) m.select(q.f);
        // if(q.p)  m.populate(q.p);

        if (q.p) {
            const qp = q.p.split(' ');

            _.each(qp, vp => {
                const op = { path: vp };

                if (q.sp && q.sp[vp]) {
                    let spvp = q.sp[vp];

                    if (toString.call(spvp) !== '[object Array]') {
                        spvp = [spvp];
                    }

                    op.populate = [];
                    _.each(spvp, v => {
                        op.populate.push({ path: v });
                    });
                }

                m.populate(op);
            });
        }

        if (opts.lean) m.lean();
    }

    if (['find', 'one', 'randomfind', 'randomone', 'ids'].includes(qt)) {
        m.exec((err, doc) => {
            cb(err, doc, _.clone(q));
        });

        m = null;
    }

    if (['findcount'].includes(qt)) {
        const a = {
            rows(cb) {
                m.exec(cb);
            },
            total(cb) {
                model.count(q.q, cb);
            },
        };

        async.parallel(a, (err, results) => {
            cb(err, {
                rows: results.rows,
                total: results.total,
            }, _.clone(q));
        });
    }

    if (qt === 'aggregate') {
        m = m.aggregate(q.pp);
        m.exec((err, doc) => {
            cb(err, doc, _.clone(q));
        });
    }

    qt = null;
};

function QueryPlugin(schema) {
    schema.statics.parse = function(q, o) {
        return parse(q, this, o);
    };

    schema.statics.q = function(q, o, cb) {
        o = o || {};
        doQuery(q, this, o, cb);
    };
}

module.exports = () => QueryPlugin;
