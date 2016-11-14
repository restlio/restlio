const mkdirp = require('mkdirp');
const path   = require('path');
const mime   = require('mime');
const dot    = require('dotty');
const fs     = require('fs');

module.exports = app => {

    const _log    = app.lib.logger;
    const _env    = app.get('env');
    const _group  = 'BOOT:RESIZE';
    const _resize = app.config[_env].resize;
    
    function setEnv(key, value) {
        process.env[key] = value;
    }

    try {
        const target = ['local', 's3', 'cloudinary'];
        const conf   = dot.get(app.config[_env], 'app.config.upload') || app.config[_env].upload;

        if( ! conf )
            return _log.info(_group, 'upload conf not found');

        const type = conf.type;

        if( ! target.includes(type) )
            return _log.info(_group, 'upload type not found');

        setEnv('DEFAULT_SOURCE', type);
        setEnv('CACHE_DEV_REQUESTS', true);
        setEnv('IMAGE_QUALITY', 100);

        if(type == 'local')
            setEnv('LOCAL_FILE_PATH', `${app.get('basedir')}/public`);

        if(type == 's3') {
            setEnv('AWS_ACCESS_KEY_ID', conf.account.key);
            setEnv('AWS_SECRET_ACCESS_KEY', conf.account.secret);
            setEnv('S3_BUCKET', conf.bucket);
        }

        const ir      = require('image-resizer-tmp');
        const env     = ir.env;
        const Img     = ir.img;
        const streams = ir.streams;

        var forwards = function(req, res, next) {
            const url = req.url.split('/_i/');

            // burası hep en sonda olacağından eğer /_i/ mevcut değilse hata dön
            if(url.length <= 1)  {
                _log.error(_group, 'improper url');
                return res.status(404).end();
            }

            req.url  = `/${url[1]}`;
            let size = url[1].split('/');

            // development için izin ver
            if(_env == 'development') {
                _log.error(_group, 'allowed for development');
                return next('route');
            }

            if(size && size.length && _resize) {
                size = size[0];
                
                if( ! _resize[req.hostname] ) {
                    _log.error(_group, 'not found hostname');
                    return res.status(404).end();                            
                }
                
                if( !_resize[req.hostname].includes(size) ) {
                    _log.error(_group, 'not allowed image size');
                    return res.status(404).end();
                }
            }

            // continue to the next route
            next('route');
        };

        var expiresIn = function(maxAge) {
            let dt = Date.now();
            dt += maxAge * 1000;

            return (new Date(dt)).toGMTString();
        };

        // image expire time
        const expiry = 60*60*24*90;
        
        app.get('*', forwards);
        app.get('/*?', (req, res, next) => {
            const image = new Img(req, res);
            const file  = `/tmp${req.path}`;

            /**
             * @TODO
             * bütün bu işlemleri redis-lock ile kilitle,
             * aynı imajı almaya çalışan beklesin, eğer ikinci requestte imaj varsa bulur ve gönderir
             * daha sonraki request'ler zaten nginx üzerinden alır
             */
            
            // check file
            fs.stat(file, (err, stat) => {
                if(stat && stat.isFile()) {
                    _log.info(`${_group}:FROM:CACHE`, req.path);
                    
                    fs.readFile(file, (err, data) => {
                        if( err || ! data )
                            return res.status(404).end();

                        // set cache
                        res.set({
                            'Cache-Control' : 'public',
                            'Expires'       : expiresIn(expiry),
                            'Last-Modified' : (new Date(1000)).toGMTString(),
                            'Vary'          : 'Accept-Encoding'
                        });
                        
                        // set type and send response
                        const lookup = mime.lookup(file);
                        res.type(lookup || 'text/plain');
                        res.status(200).send(data);
                    });
                }
                else {
                    _log.info(`${_group}:FROM:${type}`, req.path);
                    
                    image.getFile()
                        .pipe(new streams.identify())
                        .pipe(new streams.resize())
                        .pipe(new streams.filter())
                        .pipe(new streams.optimize())
                        .pipe(streams.response(req, res));
                }
            });
        });

        return true;
    }
    catch(e) {
        _log.error(_group, e.stack);
        return false;
    }

};




