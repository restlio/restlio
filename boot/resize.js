const mime = require('mime');
const dot = require('dotty');
const fs = require('fs');
const debug = require('debug');
const ir = require('image-resizer-tmp');

module.exports = app => {
    const env = app.get('env');
    const resize = app.config[env].resize;
    const log = debug('RESTLIO:BOOT:RESIZE');

    function setEnv(key, value) {
        process.env[key] = value;
    }

    try {
        const target = ['local', 's3', 'cloudinary'];
        const conf = dot.get(app.config[env], 'app.config.upload') || app.config[env].upload;
        
        if( ! conf ) {
            return log('upload conf not found');
        }

        const type = conf.type;

        if( ! target.includes(type) ) {
            return log('upload type not found');
        }
            
        setEnv('DEFAULT_SOURCE', type);
        setEnv('CACHE_DEV_REQUESTS', true);
        setEnv('IMAGE_QUALITY', 100);

        if(type === 'local') {
            setEnv('LOCAL_FILE_PATH', `${app.get('basedir')}/public`);
        }

        if(type === 's3') {
            setEnv('AWS_ACCESS_KEY_ID', conf.account.key);
            setEnv('AWS_SECRET_ACCESS_KEY', conf.account.secret);
            setEnv('S3_BUCKET', conf.bucket);
        }

        const Img = ir.img;
        const streams = ir.streams;

        const forwards = function forwards(req, res, next) {
            const url = req.url.split('/_i/');

            // burası hep en sonda olacağından eğer /_i/ mevcut değilse hata dön
            if(url.length <= 1) {
                log('improper url %s', req.url);
                // TODO: 404 yerine next('route') kullanılabilir
                return res.status(404).end();
            }

            req.url = `/${url[1]}`;
            let size = url[1].split('/');

            // development için izin ver
            if(env === 'development') {
                log('allowed for development');
                return next('route');
            }

            if(size && size.length && resize) {
                size = size[0];
                
                if( ! resize[req.hostname] ) {
                    log('not found hostname');
                    return res.status(404).end();
                }
                
                if( ! resize[req.hostname].includes(size) ) {
                    log('not allowed image size');
                    return res.status(404).end();
                }
            }

            // continue to the next route
            next('route');
            return true;
        };

        const expiresIn = function expiresIn(maxAge) {
            let dt = Date.now();
            dt += maxAge * 1000;

            return (new Date(dt)).toGMTString();
        };

        // image expire time
        const expiry = 60 * 60 * 24 * 90;
        
        app.get('*', forwards);
        app.get('/*?', (req, res) => {
            const image = new Img(req, res);
            const file = `/tmp${req.path}`;

            // TODO:
            // bütün bu işlemleri redis-lock ile kilitle,
            // aynı imajı almaya çalışan beklesin, eğer ikinci requestte imaj varsa gönderir
            // daha sonraki request'ler zaten nginx üzerinden alır
            
            // check file
            fs.stat(file, (err, stat) => {
                if(stat && stat.isFile()) {
                    log('FROM:CACHE %s', req.path);
                    
                    fs.readFile(file, (err2, data) => {
                        if( err2 || ! data ) {
                            return res.status(404).end();
                        }

                        // set cache
                        res.set({
                            'Cache-Control' : 'public',
                            Expires         : expiresIn(expiry),
                            'Last-Modified' : (new Date(1000)).toGMTString(),
                            Vary            : 'Accept-Encoding',
                        });
                        
                        // set type and send response
                        const lookup = mime.lookup(file);
                        res.type(lookup || 'text/plain');
                        return res.status(200).send(data);
                    });
                } else {
                    log(`FROM:${type} %s`, req.path);

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
    } catch(e) {
        return false;
    }
};
