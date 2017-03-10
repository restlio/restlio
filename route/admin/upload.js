const dot = require('dotty');
const _ = require('underscore');
const debug = require('debug')('RESTLIO:ROUTE:ADMIN:UPLOAD');

module.exports = app => {
    const _env = app.get('env');
    const _form = app.lib.form;
    const _schema = app.lib.schema;
    const _helper = app.lib.utils.helper;
    
    app.post('/admin/upload', (req, res, next) => {
        try {
            if( ! req.session.app ) {
                return res.json({});
            }
                
            const conf = _.clone(dot.get(app.config[_env], 'app.config.upload') || app.config[_env].upload);

            if( ! conf ) {
                debug('upload conf not found');
                return res.json({});
            }

            // ?type ile override edilebilir
            const type = req.query.type || conf.type;

            // set config overrides
            conf.type = type;
            conf.basedir = app.get('basedir');
            conf.dir += `/${_helper.random(8)}`;
            
            new app.lib.upload(req, conf).handle((err, fields, files) => {
                if(err) {
                    _helper.log('error', err);
                    return res.sendStatus(422);
                }

                // save system.images
                files.forEach(file => {
                    const obj = {
                        apps: req.session.app._id,
                        users: req.session.adminUser._id,
                        name: file.name,
                        upload_type: 'A',
                        bytes: file.size,
                        width: file.width,
                        height: file.height,
                        ext: file.ext,
                    };

                    if(type === 'local') {
                        obj.type = 'L';
                        obj.url = obj.path = file.url.replace(`${app.get('basedir')}/public`, '');
                    } else if(type === 's3') {
                        obj.type = 'S';
                        obj.url = file.url;
                        obj.path = file.path;
                    } else if(type === 'cloudinary') {
                        obj.type = 'C';
                        obj.url = file.url;
                        obj.path = file.path;
                    }

                    new _schema('system.images').init(req, res, next).post(obj, (err, doc) => {
                        if(doc) {
                            debug('image saved %o', doc);
                        }

                        res.json(doc);
                    });
                });
            });
        } catch(e) {
            _helper.log('error', e);
            res.end();
        }
    });
};
