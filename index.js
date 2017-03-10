const start = Date.now();
const timediff = require('timediff');
const express = require('express');
const load = require('express-load');
const http = require('http');
const _ = require('underscore');
const plugin = require('./plugin.json');
const Topo = require('topo');
const debug = require('debug')('RESTLIO:INDEX');

// get topo instance
const topo = new Topo();
const basic = plugin.basic;
const toString = Object.prototype.toString;

class Restlio {
    
    constructor({
        basedir = __dirname,
        verbose = false,
        name = 'app',
        env = 'development',
        port = 3001,
        test = false,
        tz = 'UTC',
        external = {},
        boot = false,
        resize = false,
        sync = false,
        apidocs = false,
    } = {}) {
        // set worker_id
        this.setEnv('worker_id', 0);
        if(typeof process.env.pm_id !== 'undefined') {
            this.setEnv('worker_id', parseInt(process.env.pm_id, 10));
        }

        // set options
        this._opts = {basedir, verbose, tz, external, boot, resize, sync, apidocs};
        process.env.TZ = tz;

        // application
        this._load = load;
        this._app = express();
        this._server = http.createServer(this._app);

        // app variables
        this.set('name', name);
        this.set('env', process.env.NODE_ENV || env);
        this.set('port', process.env.NODE_PORT || port);
        this.set('basedir', basedir);
        this.set('istest', test);
        this.set('workerid', process.env.worker_id);

        return this;
    }

    appLoad(appKey, cb) {
        if( ! plugin[appKey] ) {
            return debug('key not found! %s', appKey);
        }

        const jsonData = plugin[appKey].load;
        this.appOptions = plugin[appKey].options;
        this.topoAdd(jsonData);
        debug('loading plugins');
        debug('%O', this.nodes);

        _.each(this.nodes, node => {
            if( ! jsonData[node] ) {
                return debug('plugin not found! %s', node);
            }

            let data = jsonData[node];
            if(data === 'predefined' && basic[node]) {
                data = basic[node];
            }

            const {disabled, type = 'internal', func, key, value} = data;

            if(disabled) {
                return debug('plugin is disabled! %s', node);
            }
            
            if(type === 'internal') {
                this.internal(key, value);
            } else if(type === 'external') {
                this.external(key, value);
            } else if(type === 'function') {
                this[func || node](cb);
            }
        });
    }

    topoAdd(jsonData) {
        let current;
        _.each(jsonData, (val, key) => {
            if(val === 'predefined' && basic[key]) {
                val = basic[key];
            }

            if( ! val.group ) {
                val.group = key;
            }

            if(current && ! val.after && ! val.before) {
                val.after = current;
            }

            topo.add(key, val);
            current = key;
        });
        
        this.nodes = topo.nodes;
    }

    run(cb) {
        this.appLoad('app', cb);
    }

    workers() {
        this.appLoad('workers');
        _.each(this.appOptions, (val, key) => {
            this.set(key, val);
        });

        this._load.into(this._app, err => {
            if(err) {
                throw err;
            }

            debug('worker initialized');
        });
    }

    config() {
        this._load = this._load(`config/${this._app.get('env')}`, {
            cwd: this._opts.basedir,
            verbose: this._opts.verbose,
        });
    }

    libPost() {
        this.external('lib', this._opts.external.lib);
        this.internal('libpost');
        this.external('libpost', this._opts.external.libpost);
    }

    middle() {
        this.internal('middle');
        this.external('middle', this._opts.external.middle);
    }

    model() {
        this.internal('model');
        this.external('model', this._opts.external.model);
    }

    service() {
        this.internal('service', 'model|system');
        this.external('service', this._opts.external.service);
    }

    bootApp() {
        if(this._opts.boot) {
            this.internal('boot', this._opts.boot);
        }

        this.external('boot', this._opts.external.boot);
    }

    serviceInit() {
        this.internal('service/init');
        this.external('service', 'init');
    }

    worker() {
        this.internal('worker');
        this.external('worker', this._opts.external.worker);
    }

    resize() {
        // image resize middleware routes
        if(this._opts.resize) {
            this.internal('boot/resize');
        }
    }

    routeApi() {
        this.internal('route/api/v1');
        this.external('api', this._opts.external.api);
    }

    routeApp() {
        this.external('route', this._opts.external.route);
    }

    sync() {
        if(this._opts.sync) {
            this.internal('sync/data');
        }
    }

    docs() {
        if(this._opts.apidocs) {
            this.external('apidocs', 'config.json');
            this.internal('lib', 'apidocs/index');
        }
    }

    setEnv(key, value) {
        process.env[key] = value;
    }

    type(key) {
        return toString.call(key);
    }

    set(key, value) {
        return this._app ? this._app.set(key, value) : false;
    }

    get(key) {
        return this._app ? this._app.get(key) : false;
    }

    split(str) {
        if(toString.call(str) === '[object String]') {
            str = str.split('|');
        }

        return str;
    }

    internal(source, options) {
        this.load(source, options, __dirname);
    }

    external(source, options) {
        // external lib'lerin options olarak mutlaka belirtilmesi lazım
        // eğer options'ı bulamazsa komple source'u yükler. (options || [])
        this.load(source, options || [], this._opts.basedir);
    }

    load(source, options, cwd) {
        // set cwd
        this._load.options.cwd = cwd;

        // check options
        options = this.split(options);
        if(options) {
            return _.each(options, v => this._load.then(`${source}/${v}`));
        }

        source = this.split(source);
        _.each(source, v => this._load.then(v));
    }

    listen(cb) {
        this._load.into(this._app, (err) => {
            if(err) {
                throw err;
            }
                
            this._server.listen(this.get('port'), () => {
                debug('server listening, port: %s', this.get('port'));
                debug('worker %s', this.get('workerid'));
                const end = Date.now();
                const diff = timediff(start, end, 'Ss');
                debug(`loaded, ${diff.seconds}.${diff.milliseconds} seconds`);

                if(cb) {
                    cb();
                }
            });
        });
    }
}

module.exports = Restlio;
