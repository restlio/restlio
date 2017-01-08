const async  = require('async');
const extend = require('extend');
const moment = require('moment');
const dot    = require('dotty');
const qs     = require('qs');
const _      = require('underscore');
_.s          = require('underscore.string');

module.exports = app => {

    const _env    = app.get('env');
    const _log    = app.system.logger;
    const _form   = app.lib.form;
    const _schema = app.lib.schema;
    const _jobs   = app.boot.kue;
    const _conf   = app.config[_env].admin; // admin config
    const _system = [
        'oauth.clients',
        'system.accounts',
        'system.actions',
        'system.filters',
        'system.images',
        'system.invites',
        'system.objects',
        'system.roles'
    ];

    const _inspector = (req, redirect) => {
        const o = req.params.object;

        // app seçilmese de system.apps işlemleri yapılabilsin
        if( ! req.session.app && o != 'system.apps' )
            return false;

        let m = dot.get(req.app.model, o);

        if( ! m ) {
            redirect = redirect || true;

            if(redirect) {
                req.flash('flash', {
                    type: 'danger',
                    message: `${_.s.titleize(o)} not found`
                });
            }

            return false;
        }

        m = _.clone(m);
        return dot.get(m, 'schema.inspector');
    };

    const sortResult = (x, y) => {
        var t1 = x._id.getTime();
        var t2 = y._id.getTime();
        if (t1 < t2)
            return -1;
        else if (t1 == t2) 
            return 0;
        else 
            return 1;
    }

    // get collection graph data
    const collGraphs = (req, res, next, appSlug, colls, days) => {
        return (cb) => {
            if( ! appSlug )
                return cb(null, {});

            const endDate = moment().utc().add(1, 'days').startOf('day').valueOf();
            const step = 24 * 60 * 60 * 1000;

            async.mapLimit(colls, 4, function(coll, cb2) {
                new _schema(`${appSlug}.${coll}`).init(req, res, next).get({'_group_by_day': 'created_at', limit: 100000}, (err, doc) => {
                    cb2(null, doc);
                });
            }, function(err, results) {
                _.each(results, (v, k) => {
                    const mapData = {};
                    const map = {};
                    for (var i in v) {
                        mapData[ v[i]._id.getTime() ] = v[i];
                    }
                    for (var ms = endDate, x = 0; x < days; x++) {
                        ms -= step;
                        if ( ! ( ms in mapData ) ) 
                            map[ms] = {_id : new Date(ms), count : 0};
                        else if(mapData[ms]) 
                            map[ms] = {_id : new Date(ms), count : mapData[ms].count};
                    }
                    var finalResult = [];
                    for (var xy in map) {
                        finalResult.push(map[xy]);
                    }
                    finalResult.sort(sortResult);
                    results[k] = finalResult;
                });

                cb(null, _.object(colls, results));
            });
        };
    };

    const collCounts = (req, res, next, appSlug, colls) => {
        return (cb) =>{
            async.mapLimit(colls, 4, function(coll, cb2) {
                new _schema(`${appSlug}.${coll}`).init(req, res, next).get({'qt': 'count'}, (err, doc) => {
                    cb2(null, doc);
                });
            }, function(err, results) {
                cb(null, _.object(colls, results));
            });
        };
    };

    const collData = (req, res, next, appSlug, colls, days, cb) => {
        async.parallel({
            graphs: collGraphs(req, res, next, appSlug, colls, days),
            counts: collCounts(req, res, next, appSlug, colls)
        }, cb);
    };

    // admin main page
    app.get('/admin', (req, res, next) => {
        // console.log(req.session);

        const _slug      = dot.get(req.session, 'app.slug');
        const _resources = req.session.resources || {};
        const _keys      = Object.keys(_resources[_slug] || {});

        if(req.session.adminUser) {
            collData(req, res, next, _slug, _keys, 60, (err, results) => {
                // console.log(results);
                res.render('admin/v2/page/index', {
                    page: 'dashboard',
                    graphs: results.graphs,
                    counts: results.counts
                });    
            });
            return;
        }

        const a = {
            u(cb) {
                new _schema('system.users').init(req, res, next).get({_id: req.session.adminUserId, qt: 'one'}, (err, doc) => {
                    cb(err, doc);
                });
            },
            r(cb) {
                req.app.acl.userRoles(req.session.adminUserId, (err, roles) => {
                    req.app.acl.whatResources(roles, (err, resources) => {
                        cb(err, resources);
                    });
                });
            },
            a(cb) {
                new _schema('system.apps').init(req, res, next).get({sort: 'name'}, (err, doc) => {
                    cb(err, doc);
                });
            }
        };

        async.parallel(a, (err, results) => {
            // if(results) console.log(results);

            let render = true;

            if(err)
                _log.info(err);
            else if( ! results.u )
                _log.info('user data not found');
            else if(results.u.type != 'Admin')
                _log.info('user type is not admin'); // type = Admin olanların girişine izin veriyoruz
            else if( ! results.a )
                _log.info('apps data not found');
            else
                render = false;

            if(render)
                return res.render('admin/v2/page/index');

            // set user session data
            req.session.adminUser = results.u;

            // set apps session data
            req.session.apps = {};
            _.each(results.a, (value, key) => {
                req.session.apps[value._id.toString()] = value;

                if(value.slug == 'system')
                    req.session.systemApp = value;
            });

            // set resources session data
            req.session.resources = {};
            if(results.r) {
                const sorted = Object.keys(results.r).sort();
                const obj    = {};

                _.each(sorted, (value, key) => {
                    const sortedArr = value.split('_');
                    const modelName = value.replace('_', '.');

                    // eğer model aktif değilse resource'u alma
                    if( ! dot.get(req.app.model, modelName) )
                        return;

                    if(sortedArr.length > 1) {
                        if( ! obj[sortedArr[0]] )
                            obj[sortedArr[0]] = {};

                        obj[sortedArr[0]][sortedArr[1]] = results.r[value];
                    }
                });

                req.session.resources = obj;
                // console.log(obj);
            }

            // set default app
            if(_conf.default) {
                _.each(req.session.apps, (v, k) => {
                    if(v.slug === _conf.default)
                        req.session.app = v;
                });
            }

            // console.log(req.session);
            collData(req, res, next, _slug, _keys, 30, (err, results) => {
                // console.log(results);
                // console.log(req.session);
                res.render('admin/v2/page/index', {
                    page: 'dashboard',
                    graphs: results.graphs,
                    counts: results.counts
                });    
            });
        });
    });

    // select app
    app.get('/admin/app/:id', (req, res, next) => {
        const currApp = dot.get(req.session, `apps.${req.params.id}`);
        if(currApp) req.session.app = currApp;
        res.redirect('/admin');
    });

    // object list
    app.get('/admin/o/:object', (req, res, next) => {
        const o    = req.params.object;
        const insp = _inspector(req);

        if( ! insp )
            return res.redirect('/admin');

        try {
            const filterForm = dot.get(insp, 'Forms.filter') || false;

            const a = {
                form(cb) {
                    // get filter form
                    new _form(o, {filter: true}).init(req, res, next).prefix('/admin/p/').render(filterForm, (err, form) => {
                        cb(null, form);
                    });
                },
                filters(cb) {
                    // get filters
                    new _schema('system.filters').init(req, res, next).get({
                        users: req.session.adminUser._id,
                        object: o
                    }, (err, filters) => {
                        cb(null, filters);
                    });
                }
            };

            if(o == 'system.images') {
                a.upload = cb => {
                    // render upload box
                    app.render('admin/v2/upload/box', {object: o}, (err, upload) => {
                        cb(null, upload);
                    });
                };
            }

            async.parallel(a, (err, results) => {
                if(err)
                    _log.error(err);

                const objParts = o.split('.');
                const _slug    = objParts[0];
                const _object  = [objParts[1]];
                
                collData(req, res, next, _slug, _object, 60, (err, collResults) => {
                    // console.log(collResults);
                    // render page
                    res.render('admin/v2/page/object/list', {
                        object  : o,
                        opts    : insp.Options,
                        props   : insp.Save.properties,
                        alias   : insp.Alias,
                        sfilter : results.form,
                        filters : results.filters,
                        search  : insp.Searchable,
                        upload  : results.upload,
                        graphs  : collResults.graphs[_object],
                        counts  : collResults.counts[_object],
                        _object
                    });
                });
            });
        }
        catch(e) {
            _log.error(e.stack);
            res.redirect('/admin');
        }
    });

    // empty form
    app.get('/admin/o/:object/new', (req, res, next) => {
        const o        = req.params.object;
        const insp     = _inspector(req);
        const nocreate = dot.get(insp, 'Options.nocreate');

        if( ! insp || nocreate )
            return res.redirect('/admin');

        try {
            const newForm = dot.get(insp, 'Forms.new') || false;

            new _form(o).init(req, res, next).prefix('/admin/p/').render(newForm, (err, form) => {
                if(err)
                    _log.error(err);

                res.render('admin/v2/page/object/new', {
                    action : 'save',
                    opts   : insp.Options,
                    form,
                    err,
                    object : o
                });
            });
        }
        catch(e) {
            _log.error(e.stack);
            res.redirect('/admin');
        }
    });

    // form for sub object (array of objects) 
    app.post('/admin/form/:object/:alias/:index?', (req, res, next) => {
        const o    = req.params.object;
        const insp = _inspector(req);

        if( ! insp )
            return res.redirect('/admin');

        const alias = req.params.alias;
        const index = parseInt(req.params.index);
        const id    = req.query.id;
        
        try {
            if(id) {
                const field = insp.Alias[alias];
                const addForm = (_form, a, o, alias, index, data) => {
                    a.push(cb => {
                        new _form(o, {object: alias, index, data}).init(req, res, next).prefix('/admin/p/').render(false, (err, form) => {
                            if(form)
                                form = `<div class="col-md-4"><div class="well"><a href="javascript:void(0)" type="button" class="close" aria-label="Close" onclick="closeObjectItem(this);"><span aria-hidden="true">&times;</span></a>${form}</div></div>`;
                            
                            cb(null, form);
                        });
                    });  
                };   
                
                new _schema(o, {format: false}).init(req, res, next).getById(id, (err, doc) => {
                    // concat forms by index and data
                    if(doc[field] && doc[field].length) {
                        const a = [];
                        let i = 0;
                        _.each(doc[field], val => {
                            addForm(_form, a, o, alias, i, val);
                            i++;
                        });
                     
                        async.series(a, (err, results) => {
                            let response = '';
                            
                            if(results && results.length)
                                response = results.join(' ');
                            
                            res.json({index: i, html: response});
                        });
                    }
                    else
                        res.json({html: ''});
                });
            }
            else {
                new _form(o, {object: alias, index}).init(req, res, next).prefix('/admin/p/').render(false, (err, form) => {
                    res.send(form);
                });                
            }
        }
        catch(e) {
            _log.error(e.stack);
            res.redirect('/admin');
        }
    });
    
    // get nested view
    app.get('/admin/o/:object/nested', (req, res, next) => {
        const o        = req.params.object;
        const insp     = _inspector(req);

        if( ! insp )
            return res.redirect('/admin');

        try {
            const parentId = req.query.parentId || '{null}';
            const obj      = {
                parentId,
                sort: 'order'
            };

            // istenecek field'lar (relation, nested vs. field'larda bütün data'yı çekmesin )
            if(insp.Options.columns)
                obj.f = insp.Options.columns.join(',');

            // default 10 tane getiriyor, 1000 tane göster
            obj.l = 1000;

            // get children
            new _schema(o).init(req, res, next).get(obj, (err, children) => {
                if(err)
                    _log.error(err);

                res.render('admin/v2/page/object/partial/list/nested', {
                    children,
                    opts     : insp.Options,
                    parentId
                });
            });
        }
        catch(e) {
            _log.error(e.stack);
            res.redirect('/admin');
        }
    });

    // update nested data
    app.put('/admin/o/:object/nested/:id', (req, res, next) => {
        const o    = req.params.object;
        const insp = _inspector(req);

        if( ! insp )
            return res.redirect('/admin');

        try {
            const obj = {};
            if(req.body.order)
                obj.order = req.body.order;

            if(req.body.parentId) {
                if(req.body.parentId == 'root')
                    obj.parentId = '';
                else
                    obj.parentId = req.body.parentId;
            }

            new _schema(o).init(req, res, next).put(req.params.id, obj, (err, children) => {
                if(err)
                    _log.error(err);

                res.json({});
            });
        }
        catch(e) {
            _log.error(e.stack);
            res.redirect('/admin');
        }
    });

    app.get('/admin/o/:object/save', (req, res, next) => {
        res.redirect(`/admin/o/${req.params.object}/new`);
    });

    // save form data
    app.post('/admin/o/:object/save', (req, res, next) => {
        const o        = req.params.object;
        const insp     = _inspector(req);
        const nocreate = dot.get(insp, 'Options.nocreate');

        if( ! insp || nocreate )
            return res.redirect('/admin');

        try {
            // set app id
            // if(_system.indexOf(o) != -1)
            req.body.apps = req.session.app._id;

            // set user id
            if(o == 'system.filters')
                req.body.users = req.session.adminUser._id;

            new _schema(o).init(req, res, next).dateFormat().post(req.body, (err, doc) => {
                if(err)
                    _log.error(err);

                if( ! err && doc ) {
                    req.flash('flash', {type: 'success', message: `${_.s.titleize(o)} saved`});
                    return res.redirect(`/admin/o/${o}`);
                }

                const newForm = dot.get(insp, 'Forms.new') || false;

                new _form(o).init(req, res, next).prefix('/admin/p/').data(req.body).render(newForm, (formErr, form) => {
                    if(formErr)
                        _log.error(formErr);

                    res.render('admin/v2/page/object/new', {
                        action : 'save',
                        opts   : insp.Options,
                        form,
                        err    : err || formErr,
                        object : o
                    });
                });
            });
        }
        catch (e) {
            _log.error(e.stack);
            res.redirect('/admin');
        }
    });

    // edit form
    app.get('/admin/o/:object/edit/:id', (req, res, next) => {
        const o      = req.params.object;
        const id     = req.params.id;
        const insp   = _inspector(req);
        const noedit = dot.get(insp, 'Options.noedit');

        if( ! insp || noedit )
            return res.redirect('/admin');

        try {
            // params
            const params = {
                _id: req.params.id,
                qt: 'one'
            };

            // set app id
            if(_system.includes(o))
                params.apps = req.session.app._id;

            // set user id
            if(o == 'system.filters')
                params.users = req.session.adminUser._id;

            new _schema(o, {format: false}).init(req, res, next).get(params, (err, doc) => {
                if(err)
                    _log.error(err);

                if( err || ! doc ) {
                    req.flash('flash', {type: 'danger', message: `${_.s.titleize(o)} not found`});
                    return res.redirect(`/admin/o/${o}`);
                }

                const editForm = dot.get(insp, 'Forms.edit') || dot.get(insp, 'Forms.new') || false;

                new _form(o, {edit: true}).init(req, res, next).prefix('/admin/p/').data(doc).render(editForm, (err, form) => {
                    if(err)
                        _log.error(err);

                    res.render('admin/v2/page/object/new', {
                        action : 'update',
                        opts   : insp.Options,
                        id,
                        form,
                        err,
                        object : o
                    });
                });
            });
        }
        catch (e) {
            _log.error(e.stack);
            res.redirect('/admin');
        }
    });

    app.get('/admin/o/:object/update/:id', (req, res, next) => {
        res.redirect(`/admin/o/${req.params.object}/edit/${req.params.id}`);
    });

    // update form data
    app.post('/admin/o/:object/update/:id', (req, res, next) => {
        const o      = req.params.object;
        const id     = req.params.id;
        const insp   = _inspector(req);
        const noedit = dot.get(insp, 'Options.noedit');

        if( ! insp || noedit )
            return res.redirect('/admin');

        try {
            // set app id
            if(_system.includes(o))
                req.body.apps = req.session.app._id;

            // set user id
            if(o == 'system.filters')
                req.body.users = req.session.adminUser._id;

            new _schema(o).init(req, res, next).dateFormat().put(id, req.body, (err, doc) => {
                if(err)
                    _log.error(err);

                if( ! err || doc ) {
                    req.flash('flash', {type: 'success', message: `${_.s.titleize(o)} updated`});
                    return res.redirect(`/admin/o/${o}`);
                }

                const editForm = dot.get(insp, 'Forms.edit') || dot.get(insp, 'Forms.new') || false;

                new _form(o, {edit: true}).init(req, res, next).prefix('/admin/p/').data(req.body).render(editForm, (formErr, form) => {
                    if(formErr)
                        _log.error(formErr);

                    res.render('admin/v2/page/object/new', {
                        action : 'update',
                        opts   : insp.Options,
                        id,
                        form,
                        err    : err || formErr,
                        object : o
                    });
                });
            });
        }
        catch (e) {
            _log.error(e);
            res.redirect('/admin');
        }
    });

    function deleteIds(id, req, res, next) {
        return cb => {
            new _schema(req.params.object).init(req, res, next).remove(id, (err, doc) => {
                cb(err, doc);
            });
        };
    }

    // remove ids
    app.get('/admin/o/:object/remove/:ids', (req, res, next) => {
        const o        = req.params.object;
        let ids      = req.params.ids;
        const insp     = _inspector(req);
        const nodelete = dot.get(insp, 'Options.nodelete');

        if( ! insp || nodelete )
            return res.redirect('/admin');

        try {
            ids = ids.split(',');

            if( ! ids.length )
                return res.redirect(`/admin/o/${o}`);

            const a = [];

            for(const i in ids) {
                if(ids.hasOwnProperty(i))
                    a.push(deleteIds(ids[i], req, res, next));
            }

            async.parallel(a, (err, results) => {
                if(err)
                    _log.error(err);

                req.flash('flash', {type: 'success', message: `${_.s.titleize(o)} removed`});
                res.redirect(`/admin/o/${o}`);
            });
        }
        catch (e) {
            _log.error(e.stack);
            res.redirect('/admin');
        }
    });

    // enable item
    app.get('/admin/o/:object/enable', (req, res, next) => {
        const o    = req.params.object;
        let ids    = req.query.ids;
        const insp = _inspector(req);

        if( ! insp )
            return res.redirect('/admin');

        try {
            if(ids)
                ids = ids.split(',');
            else
                return res.redirect(`/admin/o/${o}`);

            const params = {where:
                {_id: {$in: ids}}
            };

            new _schema(o).init(req, res, next).put(params, {is_enabled: 'Y'}, (err, doc) => {
                if(err)
                    _log.error(err);

                req.flash('flash', {type: 'success', message: `${_.s.titleize(o)} enabled`});
                res.redirect(`/admin/o/${o}`);
            });
        }
        catch (e) {
            _log.error(e.stack);
            res.redirect('/admin');
        }
    });

    app.get('/admin/o/:object/build-index', (req, res, next) => {
        const o    = req.params.object;
        const ids  = req.query.ids;
        const insp = _inspector(req);

        if( ! insp || ! insp.Searchable )
            return res.redirect('/admin');

        _jobs.create('set-index-job', {
            title: `Set ${o} index job`,
            params: {
                type   : 'set-index-job',
                object : o
            }
        }).attempts(3).save();

        req.flash('flash', {type: 'success', message: `${_.s.titleize(o)} index is building`});
        res.redirect(`/admin/o/${o}`);
    });

    /**
     * REST API proxies
     */

    // object list
    app.get('/admin/p/:object', (req, res, next) => {
        const o    = req.params.object;
        const insp = _inspector(req, false);

        if( ! insp )
            return res.json({});

        try {
            // delete cache key
            delete req.query._;

            // set app id
            if(_system.includes(o))
                req.query.apps = `{in}${req.session.app._id}`;

            // system.actions için sistem objelerine erişim izni olabilir
            if(req.query.apps && o == 'system.objects' && req.session.systemApp)
                req.query.apps += `,${req.session.systemApp._id.toString()}`;

            // istenecek field'lar (relation, nested vs. field'larda bütün data'yı çekmesin )
            if(insp.Options.columns)
                req.query.f = insp.Options.columns.join(',');

            // obje sayısı 10'dan fazla olabilir
            req.query.limit = 1000;

            new _schema(o).init(req, res, next).get(req.query, (err, doc) => {
                if(err)
                    _log.error(err);

                res.json(doc || {});
            });
        }
        catch (e) {
            _log.error(e.stack);
            res.redirect('/admin');
        }
    });

    // object table data
    app.get('/admin/p/:object/table', (req, res, next) => {
        const insp = _inspector(req, false);

        if( ! insp )
            return res.json({total: 0, rows: 0});

        try {
            let o = req.params.object;
            let q = req.query || {};
            let p = {};

            // remove ajax params
            if(q._) dot.remove(q, '_');
            
            // set app id
            if(req.session.app && _system.includes(o))
                p.apps = req.session.app._id;

	        // check apps for system.users
	        if(req.session.app && o == 'system.users') {
	            const modelName = `${req.session.app.slug}.profiles`;
		        const mProfile  = dot.get(req.app.model, modelName);
		     
		        if(mProfile)
			        p.apps = req.session.app._id;
	        }
	        
            // set user id
            if(req.session.adminUser && o == 'system.filters')
                p.users = req.session.adminUser._id;

            // query type
            p.qt = 'findcount';

            if(q.limit) {
                p.l = q.limit;
                dot.remove(q, 'limit');
            }
            
            if(q.offset) {
                p.sk = q.offset;
                dot.remove(q, 'offset');
            }

            if(q.search) {
                p[insp.Options.main] = `{:like:}${q.search}`;
                dot.remove(q, 'search');
            }

            if(q.sort) {
                p.s = q.sort;
                dot.remove(q, 'sort');
                
                if(q.order == 'desc') {
                    p.s = `-${p.s}`;
                    dot.remove(q, 'order');
                }
            }
            else if(insp.Options.sort)
                p.s = insp.Options.sort;

            // remove order param
            if(q.order) 
                dot.remove(q, 'order');
            
            if(insp.Options.columns) {
                let extra;
                if(insp.Options.extra)
                    extra = insp.Options.extra.join(',');

                // istenecek field'lar
                p.f = insp.Options.columns.join(',');

                if(extra)
                    p.f += `,${extra}`;

                // istenecek field'lar içinde populate edilecek field'lar var mı kontrol ediyoruz
                const populate = [];

                // columns'a sırayla bakıyoruz
                for(const col in insp.Options.columns) {
                    if(insp.Options.columns.hasOwnProperty(col)) {
                        const currCol = insp.Options.columns[col];

                        // field alias'ının karşılık geldiği bir field key var mı kontrol ediyoruz
                        if(insp.Alias[currCol]) {
                            // key'e karşılık gelen referans var mı kontrol ediyoruz
                            const currRef = insp.Refs[ insp.Alias[currCol] ];

                            // bu key'e karşılık gelen bir referans varsa direkt key'i gönderiyoruz
                            if(currRef)
                                populate.push(insp.Alias[currCol]);
                        }
                    }
                }

                if(populate.length)
                    p.p = populate.join(',');
            }

            // decode filters
            let filter;
            if(q.filter) {
                filter = app.lib.base64.decode(q.filter);
                filter = qs.parse(filter);
                p      = extend(p, filter);
                dot.remove(q, 'filter');
            }

            // apply other query parameters
            if(Object.keys(q).length)
                p = extend(p, q);

            // execute query
            new _schema(o).init(req, res, next).get(p, (err, doc) => {
                if(err)
                    _log.error(err);

                o = q= p = filter = null;

                if( err || ! doc )
                    return res.json({total: 0, rows: 0});

                res.json(doc);
            });
        }
        catch (e) {
            _log.error(e.stack);
            res.redirect('/admin');
        }
    });

    // get object

    /*
     app.get('/admin/p/:object/:id', function(req, res, next) {
         var insp = _inspector(req, false);

         if( ! insp )
            return res.json({});

         try {
             // set access token
             var access_token = req.session.access_token;

             new _r().get('get_object', _o+req.params.object+'/'+req.params.id+'?access_token='+access_token).exec(function(err, body) {
                res.json(dot.get(body, 'get_object.data.doc'));
             });
         }
         catch (e) {
             _log.error(e.stack);
             res.redirect('/admin');
         }
     });
     */

    /**
     * filter functions
     */

    // filter form
    // [ajax]
    app.get('/admin/f/:object/:id', (req, res, next) => {
        const o    = req.params.object;
        const insp = _inspector(req);

        if( ! insp )
            return res.json({err: true});

        try {
            const a = {};

            a.get_filter = cb => {
                new _schema('system.filters').init(req, res, next).get({_id: req.params.id, qt: 'one'}, (err, doc) => {
                    cb(err, doc);
                });
            };

            a.filters = cb => {
                new _schema('system.filters').init(req, res, next).get({
                    apps: req.session.app._id,
                    users: req.session.adminUser._id,
                    object: o
                }, (err, filters) => {
                    cb(err, filters);
                });
            };

            async.parallel(a, (err, results) => {
                if(err) {
                    _log.error(err);
                    return res.json({err: true});
                }

                // decode filter
                let filter;
                try {
                    filter = app.lib.base64.decode(results.get_filter.filter);
                    filter = qs.parse(filter);
                }
                catch (e) {}

                _log.info('load filter: ', filter);

                const filterForm = dot.get(insp, 'Forms.filter') || false;

                new _form(o, {filter: true}).init(req, res, next).prefix('/admin/p/').data(filter).render(filterForm, (err, form) => {
                    if(err)
                        _log.error(err);

                    res.render('admin/v2/page/object/filter', {
                        sfilter: form,
                        filters: results.filters
                    });
                });
            });
        }
        catch(e) {
            _log.error(e.stack);
            res.json({err: true});
        }
    });

    // save filter
    // [ajax]
    app.post('/admin/f/:object', (req, res, next) => {
        const o    = req.params.object;
        const insp = _inspector(req);

        if( ! insp )
            return res.json({err: true});

        try {
            req.body.apps  = req.session.app._id; // set app id
            req.body.users = req.session.adminUser._id; // set user id

            new _schema('system.filters').init(req, res, next).post(req.body, (err, doc) => {
                if(err)
                    _log.error(err);

                if( ! err && doc )
                    return res.json({err: false});

                res.json({err: true, detail: err});
            });
        }
        catch (e) {
            _log.error(e.stack);
            res.json({err: true});
        }
    });

};