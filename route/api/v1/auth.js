const async     = require('async');
const Validator = require('validatorjs');
const dot       = require('dotty');

module.exports = app => {
    const _env      = app.get('env');
    const _schema   = app.lib.schema;
    const _helper   = app.lib.utils.helper;
    const _emitter  = app.lib.schemaEmitter;
    const _mongoose = app.core.mongo.mongoose;
    const _authConf = app.config[_env].auth;
    const _resp     = app.system.response.app;
    const _mdl      = app.middle;

    /**
     * ----------------------------------------------------------------
     * Login
     * ----------------------------------------------------------------
     */

    app.post('/api/login',
        _mdl.json,
        _mdl.client,
        _mdl.appdata,
        _mdl.appuser,
        _mdl.access, // needs app slug
        _mdl.user.waiting, // check waiting status first
        _mdl.user.enabled,
        _mdl.check.body.password,
    (req, res, next) => {
        const appData  = req.__appData;
        const userData = req.__userData;

        if( userData.hash !== _helper.hash(req.body.password, userData.salt) ) {
            return next( _resp.Unauthorized({
                type: 'InvalidCredentials',
                errors: ['wrong password'],
            }));
        }

        app.libpost.auth.userData(userData, appData.slug, res);

        // push application
        const Users = _mongoose.model('System_Users');
        Users.update({_id: userData._id}, {$addToSet: {ap: appData._id}}, {}, () => {});
        return false;
    });

    /**
     * ----------------------------------------------------------------
     * Token (send user data for verified token)
     * ----------------------------------------------------------------
     */

    app.get('/api/token',
        _mdl.json,
        _mdl.client,
        _mdl.appdata,
        _mdl.access, // needs app slug
        _mdl.authtoken,
        _mdl.auth,
    (req, res) => {
        const appData  = req.__appData;
        const userId   = req.__user.id;
        const resp     = {};

        app.libpost.auth.userProfile(userId, appData.slug, (err, results) => {
            resp.userId    = userId;
            resp.roles     = results.resources.roles || {};
            resp.resources = results.resources.resources || {};
            resp.profile   = false;

            if(results.profile) {
                resp.profile = results.profile;
            }

            _resp.OK(resp, res);
        });
    });

    /**
     * ----------------------------------------------------------------
     * Forgot Password
     * ----------------------------------------------------------------
     */

    app.post('/api/forgot',
        _mdl.json,
        _mdl.client,
        _mdl.appdata,
        _mdl.appuser,
        _mdl.access, // needs app slug
        _mdl.user.waiting, // check waiting status first
        _mdl.user.enabled,
    (req, res, next) => {
        const _group   = 'AUTH:FORGOT';
        const appData  = req.__appData;
        const userData = req.__userData;
        const userId   = req.__userData._id;
        const token    = _helper.random(24);

        // save token
        const obj = {
            reset_token   : token, // update token on every request
            reset_expires : Date.now() + 3600000,
        };

        // update user reset token
        new _schema('system.users').init(req, res, next).put(userId, obj, () => {
            // send email
            app.libpost.auth.emailTemplate('reset', appData.slug, token, userData.email, _group, () => {});

            _resp.Created({
                email: userData.email,
            }, res);
        });
    });

    app.get('/api/reset/:token',
        _mdl.json,
        _mdl.token.reset,
    (req, res) => {
        _resp.OK({}, res);
    });

    app.post('/api/reset/:token',
        _mdl.json,
        _mdl.client,
        _mdl.appdata,
        _mdl.token.reset,
        _mdl.check.body.password,
    (req, res, next) => {
        const password = req.body.password;
        const userId   = req.__userData._id;
        const slug     = req.__appData.slug;

        // password rules
        const rules = {
            password: dot.get(_authConf, `${slug}.register.password`) || 'required|min:4|max:20',
        };

        const validation = new Validator(req.body, rules);

        if(validation.fails()) {
            return next( _resp.UnprocessableEntity({
                type: 'ValidationError',
                errors: validation.errors.all(),
            }));
        }

        const a = {
            setUser(cb) {
                new _schema('system.users').init(req, res, next).put(userId, {password}, (err, affected) => {
                    cb(err, affected);
                });
            },
            updateUser(cb) {
                new _schema('system.users').init(req, res, next).put(userId, {
                    reset_token   : {__op: 'Delete'},
                    reset_expires : {__op: 'Delete'},
                },
                (err, affected) => {
                    cb(err, affected);
                });
            },
        };

        async.parallel(a, (err, results) => {
            _resp.OK({affected: results.setUser}, res);
        });

        return false;
    });

    /**
     * ----------------------------------------------------------------
     * User Invitation
     * ----------------------------------------------------------------
     */

    app.post('/api/invite',
        _mdl.json,
        _mdl.client,
        _mdl.appdata,
        _mdl.access, // needs app slug
        _mdl.authtoken,
        _mdl.auth,
        _mdl.check.body.email,
        _mdl.user.found,
    (req, res, next) => {
        const _group   = 'AUTH:INVITE';
        const appData  = req.__appData;
        const token    = _helper.random(24);
        const email    = req.body.email;
        const conf     = req.app.config[_env];
        const moderate = dot.get(conf.auth, `${appData.slug}.auth.invite_moderation`);
        const expires  = dot.get(conf.auth, `${appData.slug}.auth.invite_expires`) || 7;

        // save token
        const obj = {
            email,
            apps           : req.__appId,
            inviter        : req.__user.id,
            invite_token   : token,
            invite_expires : _helper.daysLater(expires),
            detail         : req.body.detail,
        };

        if(moderate) {
            obj.email_sent = 'N';
            obj.status     = 'WA';
        }

        const invites = new _schema('system.invites').init(req, res, next);

        invites.post(obj, (err) => {
            if(err) return invites.errResponse(err);

            // send invitation mail
            // (eğer moderasyondan geçmeyecekse maili burada atıyoruz, moderasyondan geçecekse model hook'unda atıyoruz)
            if( ! moderate ) {
                app.libpost.auth.emailTemplate('invite', appData.slug, token, email, _group, () => {});
            }

            return _resp.Created({email}, res);
        });
    });

    app.get('/api/invite/:token',
        _mdl.json,
        _mdl.token.invite,
    (req, res) => {
        _resp.OK({}, res);
    });

    app.post('/api/invite/:token',
        _mdl.json,
        _mdl.client,
        _mdl.appdata,
        _mdl.access, // needs app slug
        _mdl.token.invite,
        _mdl.default.role.invite,
    (req, res, next) => {
        const appData    = req.__appData;
        const inviteData = req.__inviteData;

        // set default password
        let password = req.body.password;
        if( ! password || password === '' ) {
            password = _helper.random(20);
        }

        // validation rules
        const rules = {
            email    : 'required|email',
            password : dot.get(_authConf, `${appData.slug}.register.password`) || 'required|min:4|max:20',
        };

        const obj = {
            password,
            email      : inviteData.email,
            roles      : req.__defaultRole,
            is_invited : 'Y',
            inviter    : inviteData.inviter,
        };

        // check waiting list
        const waiting = dot.get(_authConf, `${appData.slug}.auth.waiting_list`);

        if(waiting) {
            obj.is_enabled     = 'N';
            obj.waiting_status = 'WA';
        }
        
        // validate data
        const validation = new Validator(obj, rules, _helper._slugs);

        if(validation.fails()) {
            return _helper.bodyErrors(validation.errors.all(), next);
        }

        // save user with basic data
        const users = new _schema('system.users').init(req, res, next);

        users.post(obj, (err, user) => {
            if(err) return users.errResponse(err);

            new _schema('system.invites').init(req, res, next).put(inviteData._id, {
                invite_token   : {__op: 'Delete'},
                invite_expires : {__op: 'Delete'},
            }, () => {
                _resp.Created({email: user.email}, res); // send new user data
            });

            return false;
        });

        return false;
    });

    /**
     * ----------------------------------------------------------------
     * Register
     * ----------------------------------------------------------------
     */

    app.post('/api/register',
        _mdl.json,
        _mdl.client,
        _mdl.appdata,
        _mdl.access,
        _mdl.check.email.domains,
        _mdl.check.username.exists,
        _mdl.default.role.register,
    (req, res, next) => {
        const _group = 'AUTH:REGISTER';
        const slug   = req.__appData.slug;
        const token  = _helper.random(24);

        // validation rules
        const rules = {
            email    : 'required|email',
            password : dot.get(_authConf, `${slug}.register.password`) || 'required|min:4|max:20',
        };

        // check email verify option
        const noEmail = dot.get(_authConf, `${slug}.register.no_email_verify`) || false;

        // user data
        const data = {
            email    : req.body.email,
            password : req.body.password,
            roles    : req.__defaultRole,
        };

        // set user enable mode
        data.is_enabled = noEmail ? 'Y' : 'N';
        
        // check waiting list
        const waiting = dot.get(_authConf, `${slug}.auth.waiting_list`) || false;

        if(waiting) data.waiting_status = 'WA';
        else data.register_token = token;
        
        // profile obj
        const profiles = `${slug}.profiles`;
        const mProfile = dot.get(req.app.model, profiles);

        if(mProfile) {
            rules.name = dot.get(_authConf, `${slug}.register.name`) || 'required';
            data.name  = req.body.name;
        }

        // set username
        const username = dot.get(_authConf, `${slug}.register.username`);

        if(username) {
            rules.username = username;
            data.username  = req.body.username;
        }

        // validate data
        const validation = new Validator(data, rules, _helper._slugs);

        if(validation.fails()) {
            return _helper.bodyErrors(validation.errors.all(), next);
        }

        // save user
        const users = new _schema('system.users').init(req, res, next);

        users.post(data, (err, user) => {
            if(err) return users.errResponse(err);

            // create profile
            if(mProfile) {
                const profileObj = {
                    apps  : req.__appId,
                    users : user._id.toString(),
                    name  : req.body.name,
                };

                if(data.username) {
                    profileObj.username = data.username;
                }

                // create profile and send response
                new _schema(profiles).init(req, res, next).post(profileObj, () => {
                    _resp.Created({email: user.email}, res); // response
                    _emitter.emit('user_registered', {user}); // emit event
                });
            } else {
                _resp.Created({email: user.email}, res); // response
                _emitter.emit('user_registered', {user}); // emit event
            }

            // send email (waiting listesinde ise veya email verify yapmıyorsak mail göndermiyoruz)
            if( ! waiting && ! noEmail ) {
                app.libpost.auth.emailTemplate('register', slug, token, req.body.email, _group, () => {});
            }

            // push application
            const Users = _mongoose.model('System_Users');
            Users.update({_id: user._id}, {$addToSet: {ap: req.__appData._id}}, {}, () => {});
            return false;
        });

        return false;
    });

    app.get('/api/verify/:token',
        _mdl.json,
        _mdl.token.verify,
    (req, res) => {
        _resp.OK({}, res);
    });

    app.post('/api/verify/:token',
        _mdl.json,
        _mdl.client,
        _mdl.token.verify,
    (req, res, next) => {
        const userId = req.__userData._id;

        const a = {
            setUser(cb) {
                new _schema('system.users').init(req, res, next).put(userId, {is_enabled: 'Y'}, (err, affected) => {
                    cb(err, affected);
                });
            },
            updateUser(cb) {
                new _schema('system.users').init(req, res, next).put(userId, {
                    register_token: {__op: 'Delete'},
                },
                (err, affected) => {
                    cb(err, affected);
                });
            },
        };

        async.parallel(a, (err, results) => {
            _resp.OK({affected: results.setUser}, res);
        });
    });

    app.post('/api/resend',
        _mdl.json,
        _mdl.client,
        _mdl.appdata,
        _mdl.access, // needs app slug
        _mdl.check.body.email,
    (req, res, next) => {
        const _group = 'AUTH:RESEND';
        const slug   = req.__appData.slug;

        // check user by email
        new _schema('system.users').init(req, res, next).get({
            email: req.body.email.toLowerCase(),
            qt: 'one',
        }, (err, doc) => {
            if( err || ! doc ) {
                return next( _resp.Unauthorized({
                    type: 'InvalidCredentials',
                    errors: ['user not found'],
                }));
            } else if( ! doc.register_token ) {
                return next( _resp.Unauthorized({
                    type: 'InvalidCredentials',
                    errors: ['register token not found'],
                }));
            }
            
            // resend activation mail
            app.libpost.auth.emailTemplate('register', slug, doc.register_token, doc.email, _group, () => {
                _resp.OK({}, res);
            });

            return false;
        });
    });
    
    /**
     * ----------------------------------------------------------------
     * Change Password
     * ----------------------------------------------------------------
     */

    app.post('/api/change_password',
        _mdl.json,
        _mdl.client,
        _mdl.appdata,
        _mdl.access, // needs app slug
        _mdl.authtoken,
        _mdl.auth,
        _mdl.user.data,
    (req, res, next) => {
        const userData   = req.__userData;
        const slug       = req.__appData.slug;
        const oldPass    = req.body.old_password;
        const newPass    = req.body.new_password;
        const passRepeat = req.body.new_password_repeat;

        const data = {
            old_password        : oldPass,
            new_password        : newPass,
            new_password_repeat : passRepeat,
        };

        const rule  = dot.get(_authConf, `${slug}.register.password`) || 'required|min:4|max:20';
        const rules = {
            old_password        : 'required',
            new_password        : rule,
            new_password_repeat : `${rule}|same:new_password`,
        };

        const validation = new Validator(data, rules);

        if(validation.fails()) {
            return next( _resp.UnprocessableEntity({
                type: 'ValidationError',
                errors: validation.errors.all(),
            }));
        }

        if( userData.hash !== _helper.hash(oldPass, userData.salt) ) {
            return next( _resp.Unauthorized({
                type: 'InvalidCredentials',
                errors: ['old_password is wrong'],
            }));
        }

        // update password
        new _schema('system.users').init(req, res, next).put(userData._id, {
            password: newPass,
            password_changed: 'Y',
            password_changed_at: Date.now(),
        }, (err, affected) => {
            _resp.OK({affected}, res);
        });

        return false;
    });

    /**
     * ----------------------------------------------------------------
     * Social Login or Register
     * ----------------------------------------------------------------
     */

    app.post('/api/social',
        _mdl.json,
        _mdl.client,
        _mdl.appdata,
        _mdl.appuser, // don't throw error if user not found
        _mdl.access, // needs app slug
        _mdl.check.social,
        _mdl.check.username.exists,
        _mdl.default.role.register,
        // _mdl.user.waiting, profile data'sını token olmadan döneceğiz
        // _mdl.user.enabled, profile data'sını token olmadan döneceğiz
    (req, res, next) => {
        const appSlug     = req.__appData.slug;
        const userData    = req.__userData;
        const socialData  = req.__social;
        const accountData = req.__social.account;

        // check profile model
        const profiles = `${appSlug}.profiles`;
        const mProfile = dot.get(req.app.model, profiles);

        // set tokenDisabled
        let tokenDisabled = false;
        if(userData && (userData.is_enabled === 'No' || userData.waiting_status !== 'Accepted')) {
            tokenDisabled = true;
        }

        // return user data if found
        if(userData) {
            // create account
            if(accountData) {
                accountData.apps  = req.__appId;
                accountData.users = userData._id;
                new _schema('system.accounts').init(req, res, next).post(accountData, () => {});
            }

            // TODO: profili de kontrol et, eğer yoksa profil oluştur
            return app.libpost.auth.userData(userData, appSlug, res, tokenDisabled, accountData);
        }

        // check username after login function
        if(req.__usernameExists) {
            return next( _resp.Unauthorized({
                type: 'InvalidCredentials',
                errors: ['username exists'],
            }));
        }

        // validation rules
        const rules = {email: 'required|email'};

        // user data
        const data = {
            email    : req.body.email,
            password : _helper.random(20),
            roles    : req.__defaultRole,
        };

        // check waiting list
        const waiting = dot.get(_authConf, `${appSlug}.auth.waiting_list`);
        
        if(waiting) {
            data.is_enabled     = 'N';
            data.waiting_status = 'WA';
        }
        
        // profile obj
        if(mProfile) {
            rules.name = dot.get(_authConf, `${appSlug}.register.name`) || 'required';
            data.name  = req.body.name || socialData.name;
        }

        // set username
        const username = dot.get(_authConf, `${appSlug}.register.username`);

        if(username) {
            rules.username = username;
            data.username  = req.body.username;
        }

        // validate data
        const validation = new Validator(data, rules, _helper._slugs);

        if(validation.fails()) {
            return _helper.bodyErrors(validation.errors.all(), next);
        }

        // save user
        const users = new _schema('system.users').init(req, res, next);

        users.post(data, (err, user) => {
            if(err) return users.errResponse(err);

            // user id
            user._id = user._id.toString();
            
            // create account
            if(accountData) {
                accountData.apps  = req.__appId;
                accountData.users = user._id;
                new _schema('system.accounts').init(req, res, next).post(accountData, () => {});
            }

            // set tokenDisabled
            tokenDisabled = waiting ? true : false;

            // create profile
            if(mProfile) {
                const profileObj = {
                    apps  : req.__appId,
                    users : user._id,
                    name  : data.name,
                };

                if(data.username) {
                    profileObj.username = data.username;
                }
                    
                new _schema(profiles).init(req, res, next).post(profileObj, () => {
                    // return user data
                    app.libpost.auth.userData(user, appSlug, res, tokenDisabled, accountData);
                });
            } else {
                // return user data
                app.libpost.auth.userData(user, appSlug, res, tokenDisabled, accountData);
            }

            return false;
        });

        return false;
    });

    /**
     * ----------------------------------------------------------------
     * Waiting User List
     * ----------------------------------------------------------------
     */

    app.post('/api/waiting/accept',
        _mdl.json,
        _mdl.client,
        _mdl.appdata,
        _mdl.access, // needs app slug
        _mdl.authtoken,
        _mdl.auth,
        _mdl.data.body.userid,
        _mdl.user.acl('system.users', 'put*'),
    (req, res, next) => {
        const _group   = 'AUTH:WAITING:ACCEPT';
        const appSlug  = req.__appData.slug;
        const bodyUser = req.__bodyUser;
        
        // update user data
        new _schema('system.users').init(req, res, next).put(bodyUser._id, {
            is_enabled     : 'Y',
            waiting_status : 'AC',
        },
        (err, affected) => {
            // send information mail
            app.libpost.auth.emailTemplate('waiting/accept', appSlug, null, bodyUser.email, _group, () => {});
            
            _resp.OK({affected}, res);
        });
    });

    app.post('/api/waiting/decline',
        _mdl.json,
        _mdl.client,
        _mdl.appdata,
        _mdl.access, // needs app slug
        _mdl.authtoken,
        _mdl.auth,
        _mdl.data.body.userid,
        _mdl.user.acl('system.users', 'put*'),
    (req, res, next) => {
        const _group   = 'AUTH:WAITING:DECLINE';
        const appSlug  = req.__appData.slug;
        const bodyUser = req.__bodyUser;

        // update user data
        new _schema('system.users').init(req, res, next).put(bodyUser._id, {
            is_enabled     : 'N',
            waiting_status : 'DC',
        },
        (err, affected) => {
            // send information mail
            app.libpost.auth.emailTemplate('waiting/decline', appSlug, null, bodyUser.email, _group, () => {});

            _resp.OK({affected}, res);
        });
    });

    app.get('/api/waiting/line',
        _mdl.json,
        _mdl.client,
        _mdl.appdata,
        _mdl.access, // needs app slug
        _mdl.data.query.email,
    (req, res, next) => {
        const userData = req.__queryUser;
        
        if(userData.waiting_status === 'Accepted') {
            return next( _resp.Unauthorized({
                type: 'InvalidCredentials',
                errors: ['user is not in the waiting list'],
            }));
        }
        
        const a = {
            total(cb) {
                new _schema('system.users').init(req, res, next).get({
                    is_enabled: 'N',
                    waiting_status: 'WA',
                    qt: 'count',
                }, (err, doc) => {
                    cb(null, doc);
                });
            },
            before(cb) {
                new _schema('system.users').init(req, res, next).get({
                    _id: `{lt}${userData._id}`,
                    is_enabled: 'N',
                    waiting_status: 'WA',
                    qt: 'count',
                }, (err, doc) => {
                    cb(null, doc);
                });
            },
        };
        
        async.parallel(a, (err, results) => {
            const total  = dot.get(results, 'total.count') || 0;
            const before = dot.get(results, 'before.count') || 0;
            const diff   = total - before;
            const after  = diff - 1;
            
            _resp.OK({
                total,
                before,
                after,
                line: total - after,
            }, res);
        });

        return false;
    });
};
