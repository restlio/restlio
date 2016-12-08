const passport = require('passport');
const strategy = require('passport-facebook').Strategy;
const async    = require('async');
const _        = require('underscore');

module.exports = app => {

    const _env     = app.get('env');
    const _mdl     = app.middle;
    const _log     = app.lib.logger;
    const _schema  = app.lib.schema;
    const _conf    = app.config[_env].social;
    const _emitter = app.lib.schemaEmitter;
    const _group   = 'AUTH:SOCIAL:FACEBOOK';
    
    /**
     * init passport facebook
     */

    _.each(_conf, (value, key) => {
        const project = key;

        if( ! value.facebook || ! value.facebook.enable )
            return;

        const facebook = value.facebook;

        passport.use(new strategy({
            clientID: facebook.key,
            clientSecret: facebook.secret,
            callbackURL: facebook.callback,
            passReqToCallback : true
        },
        (req, accessToken, refreshToken, profile, done) => {
            const project = req.params.project;

            new _schema('system.apps').init(app).get({
                slug: project,
                qt: 'one'
            }, (err, apps) => {
                if(err) {
                    _log.info(_group, 'app not found');
                    return done(null);
                }

                new _schema('system.accounts').init(app).get({
                    apps: apps._id.toString(),
                    user_id: parseInt(profile.id),
                    qt: 'one'
                }, (err, account) => {

                    if(err) {
                        if(err.name != 'NotFound')
                            return done(null);
                    }

                    if( ! req.session.social )
                        req.session.social = {};

                    const profilePhoto = `http://graph.facebook.com/${profile.id}/picture?type=square`;
                    const sessionObj   = {
                        network_id: parseInt(profile.id),
                        network_id_str: profile.id,
                        user_name: profile.username || '',
                        display_name: profile.displayName || '',
                        profile_photo: profilePhoto,
                        token: accessToken,
                        refresh_token: refreshToken || ''
                    };
                    
                    _log.info(`${_group}SESSION_OBJ`, sessionObj);
                    req.session.social.facebookObj = req.session.social.facebookObj || {};

                    if( ! account ) {
                        new _schema('system.accounts').init(app).post({
                            apps: apps._id.toString(),
                            type: 'F',
                            user_id: parseInt(profile.id),
                            user_id_str: profile.id,
                            user_name: profile.username || '',
                            display_name: profile.displayName || '',
                            profile_photo: `http://graph.facebook.com/${profile.id}/picture?type=square`,
                            token: accessToken,
                            refresh_token: refreshToken || '',
                        }, (err, doc) => {
                            if(err) {
                                console.log(err);
                                return done(null);
                            }

                            sessionObj.account_id = doc._id.toString();
                            req.session.social.facebook = sessionObj;
                            req.session.social.facebookObj[profile.id] = sessionObj;
                            _emitter.emit('facebook_connected', sessionObj);

                            done(null, {facebook: {}});
                        });
                    }
                    else {
                        new _schema('system.accounts').init(app).put(account._id.toString(), {
                            user_name: profile.username || '',
                            display_name: profile.displayName || '',
                            profile_photo: `http://graph.facebook.com/${profile.id}/picture?type=square`,
                            token: accessToken
                        }, (err, affected) => {
                            sessionObj.account_id = account._id.toString();
                            req.session.social.facebook = sessionObj;
                            req.session.social.facebookObj[profile.id] = sessionObj;
                            _emitter.emit('facebook_connected', sessionObj);

                            done(null, {facebook: {}});
                        });
                    }
                });
            });
        }));

        app.get('/api/:project/auth/facebook', passport.authenticate('facebook'));

        app.get('/api/:project/facebook/callback', passport.authenticate('facebook', {
            successRedirect: facebook.success,
            failureRedirect: facebook.failure
        }));

    });

};