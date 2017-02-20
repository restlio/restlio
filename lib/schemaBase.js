const debug = require('debug')('Restlio:schemaBase');
const agent = require('superagent');
const minify = require('html-minifier').minify;
const promisify = require('es6-promisify');
const Schema = require('./schema')();

class Base extends Schema {
    
    constructor(name) {
        super(name);

        this.Create = promisify(this.post, this);
        this.Read = promisify(this.get, this);
        this.ReadById = promisify(this.getById, this);
        this.Update = promisify(this.put, this);
        this.Delete = promisify(this.remove, this);
        this.Aggr = promisify(this.aggregate, this);

        this.renderPromise = promisify(this.render, this);
        this.renderPagePromise = promisify(this.renderPage, this);
    }

    getAll(opts, cb) {
        this.get(opts, cb);
    }

    findOneOrCreate(condition = {}, doc) {
        condition.qt = 'one';
        return new Promise((resolve, reject) => {
            this.get(condition, (err, result) => {
                if (result) {
                    return resolve(result);
                }

                this.post(doc, (err, data) => {
                    return err ? reject(err) : resolve(data);
                });
            });
        });
    }

    names(type) {
        const fType = type.split(':');
        const funcName = fType.pop();
        const typeName = fType.join(':') || 'initial';
        return {funcName, typeName};
    }

    render(obj, cb) {
        const {funcName, data, cacheKey, tmpl} = obj;

        this[funcName](data, (err, doc = {}) => {
            this.App.render(tmpl, {data: doc}, (err, html) => {
                if(err) console.log(err);
                let fHtml = html;
                if(fHtml && cacheKey) {
                    fHtml = this.getHtml(fHtml);
                }

                cb(null, fHtml);
            });
        });
    }

    renderPage(obj, cb) {
        const {funcName, data = {}, cacheKey, tmpl, page, limit, url, locals} = obj;
        data.page = page;
        data.limit = limit;

        this[funcName](data, (err, doc = {}) => {
            const {rows, total} = doc; // qt: findcount ile çalışmış olması lazım
            const pages = this.Paginate({
                parampageno: 'p',
                totalItem: total,
                currentPage: page,
                itemPerPage: limit,
                url: url || '/',
            });

            const vars = {data: rows, total, pages};
            if(locals) vars.locals = locals;
            this.App.render(tmpl, vars, (err, html) => {
                if(err) console.log(err);
                let fHtml = html;
                if(fHtml && cacheKey) {
                    fHtml = this.getHtml(fHtml);
                }

                cb(null, fHtml);
            });
        });
    }

    getHtml(html) {
        return minify(html, {
            minifyJS: true,
            minifyCSS: true,
            removeComments: true,
            collapseWhitespace: true,
        });
    }

    html(type, data, opts = {}, cb) {
        const {funcName, typeName} = this.names(type);
        const {cacheKey, tmpl} = opts;
        const obj = {funcName, data, cacheKey, tmpl};
        let response = false;

        switch(typeName) {
            case 'initial':
                this.render(obj, cb);
                break;

            case 'promise':
                response = this.renderPromise(obj);
                break;

            case 'cache':
                this.Cache.exec(this, this.render, [obj], {cacheKey}, true, cb);
                break;

            case 'async':
                response = cb => this.render(obj, cb);
                break;

            case 'async:cache':
                response = this.Cache.async(this, this.render, [obj], {cacheKey}, true);
                break;

            default:
                break;
        }

        return response;
    }

    htmlPage(type, data, opts = {}, cb) {
        const {funcName, typeName} = this.names(type);
        const {cacheKey, tmpl, page, limit, url, locals} = opts;
        const obj = {funcName, data, cacheKey, tmpl, page, limit, url, locals};
        let response = false;

        switch(typeName) {
            case 'initial':
                this.renderPage(obj, cb);
                break;

            case 'promise':
                response = this.renderPagePromise(obj);
                break;

            case 'cache':
                this.Cache.exec(this, this.render, [obj], {cacheKey}, true, cb);
                break;

            case 'async':
                response = cb => this.renderPage(obj, cb);
                break;

            case 'async:cache':
                response = this.Cache.async(this, this.render, [obj], {cacheKey}, true);
                break;

            default:
                break;
        }

        return response;
    }

    json(type, data, opts = {}, cb) {
        const {funcName, typeName} = this.names(type);
        const {cacheKey} = opts;
        let response = false;

        switch(typeName) {
            case 'initial':
                this[funcName](data, cb);
                break;

            case 'promise':
                response = promisify(this[funcName], this)(data);
                break;

            case 'cache':
                this.Cache.exec(this, this[funcName], [{}], {cacheKey}, true, cb);
                break;

            case 'async':
                response = cb => this[funcName](data, cb);
                break;

            case 'async:cache':
                response = this.Cache.async(this, this[funcName], [data], {cacheKey}, true);
                break;

            default:
                break;
        }

        return response;
    }

    api(type, data, opts = {}, cb, res) {
        const {funcName, typeName} = this.names(type);
        const {cacheKey, tmpl, method} = opts;
        const obj = {funcName, data, tmpl};

        switch(typeName) {
            case 'json':
                this.request({funcName, data, res, method}, (err, response) => {
                    this.send(response.err, response.resp, res);
                });
                break;

            case 'json:cache':
                this.Cache.exec(this, this.request, [{funcName, data, res, method}], {cacheKey}, true, (err, response) => {
                    this.send(response.err, response.resp, res);
                });
                break;

            case 'html':
                this.render(obj, (err, html = '') => {
                    this.Response.OK({html}, res);
                });
                break;

            case 'html:cache':
                this.Cache.exec(this, this.render, [obj], {cacheKey}, true, (err, html = '') => {
                    this.Response.OK({html}, res);
                });
                break;

            default:
                break;
        }
    }

    request({funcName, method = '', data = {}} = {}, cb) {
        const fMethod = method.toLowerCase();
        const port = this.App.get('port');
        const req = agent[fMethod](`http://localhost:${port}/api/o/${funcName}`);

        if(fMethod === 'get') req.query(data);
        else if(fMethod === 'post') req.send(data);

        req.end((err, resp) => {
            if(err && err.status && err.response) {
                err = {status: err.status, text: err.response.text};
                resp = null;
            } else if(resp && resp.status && resp.text) {
                err = null;
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

module.exports = () => Base;
