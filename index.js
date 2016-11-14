const cluster = require('cluster');
const express = require('express');
const load    = require('express-load');
const https   = require('https');
const http    = require('http');
const io      = require('socket.io');
const _       = require('underscore');

class Restlio {
    
    constructor(options = {}) {
        this._opts   = options;
        this._master = cluster.isMaster;
        this._cores  = options.cores || process.env.NODE_CORES || require('os').cpus().length;
        this._map    = {};
        this._app    = false;
        this._test   = options.test;

        // set pm2
        const pm2 = (typeof process.env.pm_id != 'undefined');

        // fork instance
        if ( cluster.isMaster && ! this._test && ! pm2 ) {
            console.log('Restlio is loading...');
            this.fork();
            return this;
        }

        // set worker_id    
        this.setEnv('worker_id', parseInt(process.env.worker_id));

        // set worker_id for pm2
        if(pm2) {
            this.setEnv('worker_id', parseInt(process.env.pm_id));
            this._master = false;
        }

        // set options
        this._opts.basedir = options.basedir || __dirname;
        this._opts.verbose = this._test ? false : (options.verbose || false);

        // application
        this._load   = load;
        this._app    = express();
        this._server = http.createServer(this._app);

        // app variables
        this._app.set('name', this._opts.name || 'app');
        this._app.set('env', this._opts.env || process.env.NODE_ENV || 'development');
        this._app.set('port', this._opts.port || process.env.NODE_PORT || 3001);
        this._app.set('basedir', this._opts.basedir);
        this._app.set('isworker', false);
        this._app.set('istest', this._test);
        this._app.set('workerid', process.env.worker_id);

        // other options
        this._opts.core     = this._opts.core || 'mongo|redis';
        this._opts.tz       = this._opts.tz || 'UTC';
        this._opts.external = this._opts.external || {};

        // set process variables
        process.env.TZ = this._opts.tz;

        return this;
    }

    run(cb) {
        if (this._master && ! this._test)
            return;

        if(this._opts.socket)
            this._app.io = io(this._server);

        // base boot files
        const api = 'body|config|x-powered-by|cors';
        const web = 'view|compress|static|cookie|session|timezone|flash|favicon|locals|admin/redirect|cron|kue';

        // load config
        this._load = this._load(`config/${this._app.get('env')}`, {
            cwd: this._opts.basedir, 
            verbose: this._opts.verbose
        });

        // external options
        const _external = this._opts.external;
        
        this.external('apidocs', 'config.json');
        this.internal('system/logger|lib/logger|boot/uncaught');
        this.internal('core', this._opts.core);
        this.internal('lib');
        this.external('lib', _external.lib);
        this.internal('libpost');
        this.external('libpost', _external.libpost);
        this.internal('middle');
        this.external('middle', _external.middle);
        this.internal('model', 'acl|feed|oauth|system');
        this.external('model', _external.model);
        // order matters
        this.internal('system/response/app'); // before routes
        // api routes
        this.internal('boot', api);
        this.internal('route/api/v1', 'acl|auth|counter|entity|location|object');
        this.external('api', _external.api);
        // web routes
        this.internal('boot', web);
        this.internal('boot', this._opts.boot);
        this.external('boot', _external.boot);
        this.external('route', _external.route);
        // other routes
        this.internal('route/api/v1', 'social'); // requires session
        this.internal('route/admin');
        if(this._opts.resize) this.internal('boot/resize'); // image resize middleware routes
        this.internal('system/handler/app'); // after routes
        this.internal('sync/data');
        this.listen(cb);

        return this;
    }

    workers() {
        if (this._master)
            return;
        
        // base boot files
        const boot = 'view|cron|kue|shortener';

        // set worker
        this._app.set('isworker', true);

        // load config
        this._load = this._load(`config/${this._app.get('env')}`, {
            cwd: this._opts.basedir,
            verbose: this._opts.verbose
        });

        // external options
        const _external = this._opts.external;
        
        this.internal('system/logger|lib/logger|boot/uncaught');
        this.internal('core', this._opts.core);
        this.internal('lib');
        this.external('lib', _external.lib);
        this.internal('libpost');
        this.external('libpost', _external.libpost);
        this.internal('middle');
        this.external('middle', _external.middle);
        this.internal('model', 'acl|feed|oauth|system');
        this.external('model', _external.model);
        this.internal('boot', boot);
        this.internal('boot', this._opts.boot);
        this.external('boot', _external.boot);
        this.internal('worker');
        this.external('worker', _external.worker);

        const self = this;

        this._load.into(this._app, (err, instance) => {
            if(err) throw err;
            self._app.lib.logger.instance('restlio', 'worker initialized');
        });
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

    instance(worker_id) {
        const worker = cluster.fork({worker_id});
        this._map[worker.id] = worker_id;
    }

    fork() {
        if ( ! this._master )
            return;

        for (let i = 0; i < this._cores; i++) {
            this.instance(i);
        }

        const self = this;
        cluster.on('exit', (worker, code, signal) => {
            const old_worker_id = self._map[worker.id];
            delete self._map[worker.id];
            self.instance(old_worker_id);
        });
    }

    split(str) {
        if(Object.prototype.toString.call(str) == '[object String]')
            str = str.split('|');

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
        if ( (this._master || ! this._app) && ! this._test )
            return false;

        // set cwd
        this._load.options.cwd = cwd;

        // check options
        options = this.split(options);
        if(options)
            return _.each(options, v => this._load.then(`${source}/${v}`));

        source = this.split(source);
        _.each(source, v => this._load.then(v));
    }

    listen(cb) {
        if ( (this._master || ! this._app) && ! this._test )
            return false;

        const self = this;

        this._load.into(this._app, (err, instance) => {
            if(err) throw err;

            // socket route
            if(self._opts.socket) {
                const router = new self._app.lib.router();
                self._app.io.route = (namespace, route, fn) => router.add(namespace, route, fn);
            }

            self._server.listen(self.get('port'), () => {
                self._app.lib.logger.instance('restlio', `server listening, port:${self.get('port')}, worker: ${self.get('workerid')}`);
                if(cb) cb();
            });
        });
    }
}

module.exports = Restlio;




