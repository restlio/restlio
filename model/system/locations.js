const material     = require('mongoose-materialized');
const mongoosastic = require('mongoosastic');
const slug         = require('speakingurl');
const php          = require('phpjs');
const dot          = require('dotty');
const _            = require('underscore');

module.exports = app => {

	const _env      = app.get('env');
    const _log      = app.lib.logger;
    const _mongoose = app.core.mongo.mongoose;
    const _query    = app.lib.query;
    const _emitter  = app.lib.schemaEmitter;
    const _syncConf = app.config[_env].sync;
    const _index    = dot.get(_syncConf, 'index.system_locations');
    const _elastic  = app.config[_env].elasticsearch || dot.get(app.config[_env], 'data.elasticsearch');
    const _worker   = parseInt(process.env.worker_id);
    const _isWorker = app.get('isworker');
    const _group    = 'MODEL:system.locations';

    // types
    const ObjectId  = _mongoose.Schema.Types.ObjectId;
    const Mixed     = _mongoose.Schema.Types.Mixed;

    /**
     * ----------------------------------------------------------------
     * Schema
     * ----------------------------------------------------------------
     */

    const Schema = {
        parentId : {type: ObjectId, ref: 'System_Locations', alias: 'parentId', index: true},
        id  : {type: Number, default: 0, alias: 'import_id', unique: true, sparse: true},
        n   : {type: String, required: true, alias: 'name', es_indexed: true, index: true},
        an  : {type: String, required: true, alias: 'asciiname', es_indexed: true, index: true},
        uri : {type: String, required: true, alias: 'uri', index: true},
        uen : [{type: String, alias: 'uri_en', index: true}],
        utr : [{type: String, alias: 'uri_tr', index: true}],
        uc  : {type: String, required: true, alias: 'uri_code', index: true},
        aen : [{type: String, alias: 'alternate_en', es_indexed: true}],
        atr : [{type: String, alias: 'alternate_tr', es_indexed: true}],
        l   : [{type: Number, alias: 'location'}],
        fcl : {type: String, alias: 'feature_class'},
        fc  : {type: String, required: true, alias: 'feature_code', es_indexed: true, index: true},
        cc  : {type: String, required: true, alias: 'country_code', es_indexed: true, index: true},
        p   : {type: Number, default: 0, alias: 'population', es_indexed: true},
        w   : {type: Number, default: 0, alias: 'weight', es_indexed: true, index: true},
        s   : {type: Number, default: 0, alias: 'score', es_indexed: true}
    };

    /**
     * ----------------------------------------------------------------
     * Settings
     * ----------------------------------------------------------------
     */

    Schema.parentId.settings = {label: 'Parent', display: 'asciiname'};
    Schema.n.settings        = {label: 'Name'};
    Schema.an.settings       = {label: 'Ascii Name'};
    Schema.aen[0].settings   = {label: 'English Name'};
    Schema.atr[0].settings   = {label: 'Turkish Name'};
    Schema.fc.settings       = {label: 'Feature Code'};
    Schema.cc.settings       = {label: 'Country Code'};
    Schema.p.settings        = {label: 'Population'};

    /**
     * ----------------------------------------------------------------
     * Load Schema
     * ----------------------------------------------------------------
     */

    const LocationSchema = app.libpost.model.loader.mongoose(Schema, {
        Name: 'System_Locations',
        Options: {
            singular : 'System Location',
            plural   : 'System Locations',
            columns  : ['name', 'asciiname', 'alternate_tr', 'alternate_en'],
            main     : 'name',
            perpage  : 10
        },
        Forms: {
            'filter': ['name', 'asciiname', 'alternate_tr', 'alternate_en', 'uri_code', 'feature_code', 'country_code']
        }
    });

    // plugins
    LocationSchema.plugin(_query);
    LocationSchema.plugin(material);
    
    if(_elastic) {
	    // get countries json
	    const countries = require('../../mapping/system/countries');
	    
	    LocationSchema.plugin(mongoosastic, {
            host: _elastic.host,
            port: _elastic.port,
            auth: _elastic.auth,
            bulk: {
                delay: 50
            },
            transform(data, repo) {
	            if(repo.cc && countries[repo.cc]) {
					const country  = countries[repo.cc];	
		            data.country = `${country.n} ${country.aen.join(' ')} ${country.atr.join(' ')}`;
	            }
	            
	            return data;
            }
        });        
    }

    // indexes
    LocationSchema.index({l: '2d'});
    LocationSchema.index({p: -1});
    LocationSchema.index({aen: 1});
    LocationSchema.index({atr: 1});

    // set auto index
    LocationSchema.set('autoIndex', dot.get(_syncConf, 'locations.autoindex') || false);
    
    /**
     * ----------------------------------------------------------------
     * Pre Save Hook
     * ----------------------------------------------------------------
     */

    String.prototype.trToLower = function() {
        let string = this;
        const letters = { "İ": "i", "I": "ı", "Ş": "ş", "Ğ": "ğ", "Ü": "ü", "Ö": "ö", "Ç": "ç" };
        string = string.replace(/(([İIŞĞÜÇÖ]))/g, letter => letters[letter]);
        return string.toLowerCase();
    };

    LocationSchema.pre('save', next => {

        const self  = this;
        self._isNew = self.isNew;

        if(self.an)
            self.uri = slug(self.an.toLowerCase(), {separator: '-', mark: false});

        if(self.aen.length) {
            const uen = [];
            _.each(self.aen, (aen, key) => {
                uen.push( slug(aen.toLowerCase(), {separator: '-', mark: false}) );
            });

            self.uen = uen;
        }

        if(self.atr.length) {
            const utr = [];
            _.each(self.atr, (atr, key) => {
                utr.push( slug(atr.trToLower(), {separator: '-', mark: false, lang: 'tr'}) );
            });

            self.utr = utr;
        }

        next();

    });

    /**
     * ----------------------------------------------------------------
     * Pre Save Hook
     * ----------------------------------------------------------------
     */

    LocationSchema.post('save', doc => {

        const self = this;
        if(self._isNew) {}

    });


    const Location = _mongoose.model('System_Locations', LocationSchema);

    /*
     Location.esTruncate(function(err) {

     });
    */

    if(_worker === 0 && _isWorker && _index) {
        const stream = Location.synchronize();
        let count    = 0;

        stream.on('data', (err, doc) => {
            console.log(`data: ${count++}`);
        });

        stream.on('close', () => {
            console.log(`indexed ${count} documents!`);
        });

        stream.on('error', err => {
            console.log(err);
        });
    }

    return Location;

};

