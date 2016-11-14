const geonames = require('geonames-reader');
const php      = require('phpjs');
const crypto   = require('crypto');
const slug     = require('speakingurl');
const dot      = require('dotty');
const _        = require('underscore');

module.exports = app => {

    const _env      = app.get('env');
    const _base     = app.get('basedir');
    const _log      = app.system.logger;
    const _form     = app.lib.form;
    const _schema   = app.lib.schema;
    const _conf     = app.config[_env];
    const _jobs     = app.boot.kue;
    const _mongoose = app.core.mongo.mongoose;
    const _group    = 'ROUTE:ADMIN:IMPORT';

    const _random = len => // return required number of characters
    crypto.randomBytes(Math.ceil(len/2))
        .toString('hex') // convert to hexadecimal format
        .slice(0, len);

    app.get('/admin/import/countries', (req, res, next) => {

        try {
            const Model = _mongoose.model('System_Locations');
            const conf  = _conf.locations;
            const file  = `${_base}/${conf.base}/allCountries.txt`;
            let i       = 0;
            let d       = [];
            const w     = require(`${_base}/${conf.base}/weights`);

            geonames.read(file, (feature, cb) => {

                i++;
                console.log(`${i}. ${feature.name}`);

                try {
                    d.push({
                        parentId: null,
                        path: '',
                        id: feature.id,
                        n: feature.name,
                        an: feature.asciiname,
                        uri: slug(feature.asciiname.toLowerCase(), {separator: '-', mark: false}),
                        uc: _random(8),
                        l: [feature.longitude, feature.latitude],
                        fcl: feature.feature_class,
                        fc: feature.feature_code,
                        cc: feature.country_code,
                        p: feature.population
                    });

                    if(d.length == 100) {
                        Model.collection.insert(_.clone(d), (err, docs) => {
                            if(err)
                                _log.error(`${_group}:COUNTRIES`, err);

                            _log.info(`${_group}:COUNTRIES:DOCS`, docs.length);
                        });

                        cb();
                        d = [];
                    }
                    else
                        cb();
                }
                catch(e) {
                    _log.error(e);
                    cb();
                }

            }, err => {
                console.log('All done!');
            });

            res.json({});
        }
        catch(e) {
            _log.error(e);
            res.end();
        }
    });

    app.get('/admin/import/alternate', (req, res, next) => {
        try {
            const Model = _mongoose.model('System_Locations');
            const conf  = _conf.locations;
            const file  = `${_base}/${conf.base}/alternateNames.txt`;
            let i       = 0;

            geonames.read(file, (feature, cb) => {
                i++;
                console.log(`${i}. ${feature.isolanguage}::${feature.alternate_name}`);

                const iso = feature.isolanguage;
                let field;
                let uriField;

                if(iso == 'eng' || iso == 'en') {
                    field    = 'aen';
                    uriField = 'en';
                }
                else if(iso == 'tur' || iso == 'tr') {
                    field    = 'atr';
                    uriField = 'tr';
                }

                if( ! field ) {
                    _log.info(`${_group}:NOTFOUND:FIELD`, field);
                    return cb();
                }

                const obj = {$addToSet: {}};
                obj.$addToSet[field] = feature.alternate_name;

                const _s_obj = {separator: '-', mark: false};
                if(field == 'atr')
                    _s_obj.lang = 'tr';

                obj.$addToSet[`u${uriField}`] = slug(feature.alternate_name, _s_obj),

                Model.collection.update({id: feature.geoname_id}, obj, (err, affected) => {
                    if(err)
                        return _log.error(`${_group}:ALTERNATE`, err);

                    _log.info(`${_group}:ALTERNATE:AFFECTED`, 1);
                });

                cb();
            }, err => {
                console.log('All done!');
            });

            res.json({});
        }
        catch(e) {
            _log.error(e);
            res.end();
        }
    });

    app.get('/admin/import/hierarchy', (req, res, next) => {
        try {
            const conf = _conf.locations;
            const file = `${_base}/${conf.base}/hierarchy.txt`;
            const loc  = _mongoose.model('System_Locations');
            let i      = 0;

            geonames.read(file, (feature, cb) => {

                i++;

                (((loc, feature, i, cb) => {
                    loc.findOne({id: feature.child_id}, (err, child) => {
                        if( err || ! child )
                            return cb();

                        loc.findOne({id: feature.parent_id}, (err, parent) => {
                            console.log(`${i}. ${child.an}`);

                            if( err || ! parent )
                                return cb();

                            child.parentId = parent._id;
                            child.save(err => {
                                if(err)
                                    _log.error(`${_group}:HIERARCHY`, err);

                                cb();
                            });
                        });

                    });
                }))(loc, feature, i, cb);

            }, err => {
                console.log('All done!');
            });

            res.json({});
        }
        catch(e) {
            _log.error(e);
            res.end();
        }
    });

};


