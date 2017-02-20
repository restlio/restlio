const express = require('express');
const load = require('express-load');
const http = require('http');
const _ = require('underscore');

class Restlio {
    
    constructor(options = {}) {
        this._opts = options;

        // set worker_id
        this.setEnv('worker_id', 0);
        if(typeof process.env.pm_id !== 'undefined') {
            this.setEnv('worker_id', parseInt(process.env.pm_id, 10));
        }

        // set options
        this._opts.basedir = options.basedir || __dirname;
        this._opts.verbose = options.verbose || false;

        // application
        this._load = load;
        this._app = express();
        this._server = http.createServer(this._app);

        // app variables
        this._app.set('name', this._opts.name || 'app');
        this._app.set('env', this._opts.env || process.env.NODE_ENV || 'development');
        this._app.set('port', this._opts.port || process.env.NODE_PORT || 3001);
        this._app.set('basedir', this._opts.basedir);
        this._app.set('isworker', false);
        this._app.set('istest', options.test || false);
        this._app.set('workerid', process.env.worker_id);

        // other options
        this._opts.tz = this._opts.tz || 'UTC';
        this._opts.external = this._opts.external || {};

        // set process variables
        process.env.TZ = this._opts.tz;

        // libraries
        this._libs = [
            'utils/helper|auth|cache|denormalize|form|index|',
            'inspector|logger|mailer|paginate|query|randomize|request|',
            'schema|schemaBase|upload|user',
        ].join('');

        // services
        this._app._services = [];

        return this;
    }

    run(cb) {
        const _opts = this._opts;
        const _external = _opts.external;
        
        this.loadConfig();
        this.internal('boot/start|lib/logger');
        this.loadBase();
        // --- order matters
        this.internal('system/response/app'); // before routes
        // --- api routes
        this.internal('boot/api');
        this.internal('route/api/v1');
        this.external('api', _external.api);
        // --- web routes
        this.internal('boot/web');
        this.loadBoot();
        this.loadServiceInit();
        this.external('route', _external.route);
        // --- other routes
        this.internal('route/admin');
        this.loadResize();
        this.initServices();
        this.internal('system/handler/app'); // after routes
        this.loadSync();
        this.apiDocs();
        this.listen(cb);

        return this;
    }

    workers() {
        this._app.set('isworker', true);

        this.loadConfig();
        this.internal('boot/start|lib/logger');
        this.loadBase();
        this.loadServiceInit();
        this.internal('boot/worker');
        this.loadBoot();
        this.loadWorker();

        this._load.into(this._app, (err) => {
            if(err) throw err;
            this._app.lib.logger.instance('Restlio', 'worker initialized');
        });
    }

    loadConfig() {
        this._load = this._load(`config/${this._app.get('env')}`, {
            cwd: this._opts.basedir,
            verbose: this._opts.verbose,
        });
    }

    loadBase() {
        this.loadCore();
        this.loadLib();
        this.loadMiddle();
        this.loadModel();
        this.loadService();
    }

    loadCore() {
        this.internal('core', 'mongo|redis|cache');
        this.external('core', this._opts.external.core);
    }

    loadLib() {
        this.internal('lib', this._libs);
        this.external('lib', this._opts.external.lib);
        this.internal('libpost');
        this.external('libpost', this._opts.external.libpost);
    }

    loadMiddle() {
        this.internal('middle');
        this.external('middle', this._opts.external.middle);
    }

    loadModel() {
        this.internal('model');
        this.external('model', this._opts.external.model);
    }

    loadService() {
        this.internal('service', 'model|system');
        this.external('service', this._opts.external.service);
    }

    loadBoot() {
        if(this._opts.boot) {
            this.internal('boot', this._opts.boot);
        }

        this.external('boot', this._opts.external.boot);
    }

    loadServiceInit() {
        this.internal('service/init');
        this.external('service', 'init');
    }

    loadWorker() {
        this.internal('worker');
        this.external('worker', this._opts.external.worker);
    }

    loadResize() {
        // image resize middleware routes
        if(this._opts.resize) {
            this.internal('boot/resize');
        }
    }

    service(loader, opts) {
        this._app._services.push({loader, opts});
    }

    initServices() {
        this.internal('boot/service');
    }

    loadSync() {
        if(this._opts.sync) {
            this.internal('sync/data');
        }
    }

    apiDocs() {
        if(this._opts.apidocs) {
            this.external('apidocs', 'config.json');
            this.internal('lib', 'apidocs/index');
        }
    }

    setEnv(key, value) {
        process.env[key] = value;
    }

    type(key) {
        return Object.prototype.toString.call(key);
    }

    set(key, value) {
        return this._app ? this._app.set(key, value) : false;
    }

    get(key) {
        return this._app ? this._app.get(key) : false;
    }

    split(str) {
        if(Object.prototype.toString.call(str) === '[object String]') {
            str = str.split('|');
        }

        return str;
    }

    internal(source, options) {
        this.load(source, options, __dirname);
    }

    external(source, options) {
        // external lib'lerin options olarak mutlaka belirtilmesi lazım
        // eğer options'ı bulamazsa komple source'u yükleyeceği için "options || []" şeklinde kullan
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
        return false;
    }

    listen(cb) {
        this._load.into(this._app, (err) => {
            if(err) throw err;
            this._server.listen(this.get('port'), () => {
                if(this._opts.verbose) {
                    const _port = this.get('port');
                    const _worker = this.get('workerid');

                    this._app.lib.logger.instance('Restlio', `server listening, port:${_port}, worker: ${_worker}`);
                }

                if(cb) {
                    cb();
                }
            });
        });

        return false;
    }
}

module.exports = Restlio;
