const passport = require('passport');
const strategy = require('passport-instagram').Strategy;
const async    = require('async');
const dot      = require('dotty');
const _        = require('underscore');


module.exports = app => {

    const _env     = app.get('env');
    const _mdl     = app.middle;
    const _schema  = app.lib.schema;
    const _conf    = app.config[_env].social;
    const _emitter = app.lib.schemaEmitter;
    const _group   = 'AUTH:SOCIAL:INSTAGRAM';
    
    /**
     * init passport instagram
     */

    _.each(_conf, (value, key) => {
        const project = key;

        if( ! value.instagram || ! value.instagram.enable )
            return;

        const instagram = value.instagram;

        passport.use(new strategy({
            clientID: instagram.key,
            clientSecret: instagram.secret,
            callbackURL: instagram.callback,
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

                    const profilePhoto = dot.get(profile, '_json.data.profile_picture') || '';
                    const sessionObj   = {
                        network_id: parseInt(profile.id),
                        network_id_str: profile.id,
                        user_name: profile.username || '',
                        display_name: profile.displayName || '',
                        profile_photo: profilePhoto,
                        token: accessToken,
                        refresh_token: refreshToken
                    };
                    
                    if( ! account ) {
                        new _schema('system.accounts').init(app).post({
                            apps: apps._id.toString(),
                            type: 'I',
                            user_id: parseInt(profile.id),
                            user_id_str: profile.id,
                            user_name: profile.username,
                            display_name: profile.displayName,
                            profile_photo: profilePhoto,
                            token: accessToken,
                            refresh_token: refreshToken,
                        }, (err, doc) => {
                            if(err) {
                                console.log(err);
                                return done(null);
                            }

                            sessionObj.account_id = doc._id.toString();
                            req.session.social.instagram = sessionObj;
                            _emitter.emit('instagram_connected', sessionObj);

                            done(null, {instagram: {}});
                        });
                    }
                    else {
                        new _schema('system.accounts').init(app).put(account._id.toString(), {
                            user_name: profile.username,
                            display_name: profile.displayName,
                            profile_photo: dot.get(profile, '_json.data.profile_picture'),
                            token: accessToken
                        }, (err, affected) => {
                            sessionObj.account_id = account._id.toString();
                            req.session.social.instagram = sessionObj;
                            _emitter.emit('instagram_connected', sessionObj);

                            done(null, {instagram: {}});
                        });
                    }
                });
            });
        }));

        app.get('/api/:project/auth/instagram', passport.authenticate('instagram'));

        app.get('/api/:project/instagram/callback', passport.authenticate('instagram', {
            successRedirect: instagram.success,
            failureRedirect: instagram.failure
        }));

    });

};