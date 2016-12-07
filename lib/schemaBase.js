const debug  = require('debug')('restlio:schemaBase');
const agent  = require('superagent');
const minify = require('html-minifier').minify;
const Schema = require('./schema')();

class Base extends Schema {
    
    constructor(name) {
        super(name);
    }

    getAll(opts, cb) {
        this.get(opts, cb);
    }

    render(opts, cb) {
        this[opts.funcName](opts.data, (err, doc) => {
            this.AppService.render(opts.tmpl, (doc || {}), (err, html) => {
                if(html && opts.cacheKey)
                    html = minify(html, {minifyJS: true, minifyCSS: true, removeComments: true, collapseWhitespace: true});

                cb(null, html);
            });
        });
    }

    names(type) {
        type = type.split(':');
        const funcName = type.pop();
        const typeName = type.join(':') || 'initial';
        return {funcName, typeName};
    }

    html(type, data, opts, cb, res) {
        opts           = opts || {};
        const names    = this.names(type);
        const funcName = names.funcName;
        const cacheKey = opts.cache;
        const tmpl     = opts.tmpl;
        const obj      = {tmpl, funcName, data, cacheKey};
        let response   = false;

        switch(names.typeName) {
            case 'initial':
                this.render(obj, cb);
            break;   

            case 'cache':
                this.CacheService.exec(this, this.render, [obj], {cacheKey}, true, cb);
            break;

            case 'async':
                response = cb => this.render(obj, cb);
            break;  

            case 'async:cache':
                response = this.CacheService.async(this, this.render, [obj], {cacheKey}, true);
            break;    
        }

        return response;
    }

    json(type, data, opts, cb, res) {
        opts           = opts || {};
        const names    = this.names(type);
        const funcName = names.funcName;
        const cacheKey = opts.cache;
        let response   = false;

        switch(names.typeName) {
            case 'initial':
                this[funcName](data, cb);
            break;   

            case 'cache':
                this.CacheService.exec(this, this[funcName], [{}], {cacheKey}, true, cb);
            break;   

            case 'async':
                response = cb => this[funcName](data, cb);
            break;   

            case 'async:cache':
                response = this.CacheService.async(this, this[funcName], [data], {cacheKey}, true);
            break; 
        }

        return response;
    }

    api(type, data, opts, cb, res) {
        opts           = opts || {};
        const names    = this.names(type);
        const funcName = names.funcName;
        const cacheKey = opts.cache;
        const tmpl     = opts.tmpl;
        const method   = opts.method;
        const obj      = {tmpl, funcName, data};

        switch(names.typeName) {
            case 'json':
                this.request({funcName, data, res, method}, (err, response) => {
                    this.send(response.err, response.resp, res);
                });
            break;      

            case 'json:cache':
                this.CacheService.exec(this, this.request, [{funcName, data, res, method}], {cacheKey}, true, (err, response) => {
                    this.send(response.err, response.resp, res);
                });
            break;    

            case 'html':
                this.render(obj, (err, html) => {
                    html = html || '';
                    this.ResponseService.OK({html}, res);
                });
            break;       

            case 'html:cache':
                this.CacheService.exec(this, this.render, [obj], {cacheKey}, true, (err, html) => {
                    html = html || '';
                    this.ResponseService.OK({html}, res);
                });
            break;      
        }
    }

    request(opts, cb) {
        opts         = opts || {};
        opts.method  = opts.method || '';
        const method = opts.method.toLowerCase();
        const data   = opts.data || {};
        const port   = this.AppService.get('port');
        const req    = agent[method](`http://localhost:${port}/api/o/${opts.funcName}`);

        if(method == 'get')
            req.query(data);
        else if(method == 'post')
            req.send(data);

        req.end((err, resp) => {
            if(err && err.status && err.response) {
                err  = {status: err.status, text: err.response.text};
                resp = null;
            }
            else if(resp && resp.status && resp.text) {
                err  = null;
                resp = {status: resp.status, text: resp.text};
            }

            cb(null, {err, resp});
        });
    }

    send(err, resp, res) {
        if(err && err.status && err.text) {
            res.status(err.status).json(JSON.parse(err.text));
            return;
        }
        
        res.status(resp.status).json(JSON.parse(resp.text));
    }
}

module.exports = app => Base;
