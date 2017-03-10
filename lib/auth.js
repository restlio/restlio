const Validator = require('validatorjs');
const crypto = require('crypto');

// TODO: views, rules vs. her şeyi config'e bağla
function hash(passwd, salt) {
    return crypto.createHmac('sha256', salt).update(passwd).digest('hex');
}

class Auth {

    loginForm(req, res) {
        if(req.session.adminUserId) {
            return res.redirect('/admin');
        }

        return res.render('admin/v2/page/auth/login');
    }

    login(req, res, next) {
        if(req.session.adminUserId) {
            return res.redirect('/admin');
        }

        const rules = {
            email    : 'required|email',
            password : 'required|min:4|max:32',
        };

        const validation = new Validator(req.body, rules);

        if(validation.fails()) {
            return res.render('admin/v2/page/auth/login', {
                error: true,
                message: validation.errors.all(),
            });
        }

        const _schema = req.app.lib.schema;

        new _schema('system.users').init(req, res, next).get({
            email: req.body.email,
            ty: 'A',
            ie: 'Y',
            qt: 'one',
        },
        (err, doc) => {
            if( ! doc ) {
                return res.render('admin/v2/page/auth/login', {
                    error: true,
                    message: {
                        email: 'Email not found',
                    },
                });
            }

            if( doc.hash !== hash(req.body.password, doc.salt) ) {
                return res.render('admin/v2/page/auth/login', {
                    error: true,
                    message: {
                        password: 'Wrong password',
                    },
                });
            }

            req.session.adminUserId = doc._id.toString();
            return res.redirect('/admin');
        });

        return false;
    }

    logout(req, res) {
        req.session.destroy();
        res.redirect('/admin/login');
    }
    
}

module.exports = () => new Auth();
