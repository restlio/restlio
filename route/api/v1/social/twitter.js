const passport = require('passport');
const strategy = require('passport-twitter').Strategy;
const async    = require('async');
const dot      = require('dotty');
const _        = require('underscore');

module.exports = app => {

    const _env     = app.get('env');
    const _mdl     = app.middle;
    const _log     = app.lib.logger;
    const _schema  = app.lib.schema;
    const _conf    = app.config[_env].social;
    const _emitter = app.lib.schemaEmitter;
    const _group   = 'AUTH:SOCIAL:TWITTER';
    
    /**
     * init passport twitter
     */

    _.each(_conf, (value, key) => {
        const project = key;

        if( ! value.twitter || ! value.twitter.enable )
            return;

        const twitter = value.twitter;

        passport.use(new strategy({
            consumerKey: twitter.key,
            consumerSecret: twitter.secret,
            callbackURL: twitter.callback,
            passReqToCallback : true
        },
        (req, token, tokenSecret, profile, done) => {
            const project = req.params.project;
            _log.info(`${_group}:PROJECT`, project);
            _log.info(`${_group}:QS`, req.query);
            
            new _schema('system.apps').init(app).get({
                slug: project,
                qt: 'one'
            }, (err, apps) => {
                if(err) {
                    console.log(err);
                    _log.info(_group, 'app not found');
                    return done(null);                    
                }

                new _schema('system.accounts').init(app).get({
                    apps: apps._id.toString(),
                    user_id: parseInt(profile.id),
                    qt: 'one'
                }, (err, account) => {

                    if(err) {
                        console.log(err);
                        if(err.name != 'NotFound')
                            return done(null);                        
                    }

                    if( ! req.session.social )
                        req.session.social = {};

                    const profilePhoto = dot.get(profile, '_json.profile_image_url') || '';
                    const location     = dot.get(profile, '_json.location') || '';
                    
                    const sessionObj   = {
                        network_id: parseInt(profile.id),
                        network_id_str: profile.id,
                        user_name: profile.username || '',
                        display_name: profile.displayName || '',
                        profile_photo: profilePhoto,
                        location,
                        token,
                        token_secret: tokenSecret
                    };
                            
                    _log.info(`${_group}SESSION_OBJ`, sessionObj);
                    
                    if( ! account ) {
                        new _schema('system.accounts').init(app).post({
                            apps: apps._id.toString(),
                            type: 'T',
                            user_id: parseInt(profile.id),
                            user_id_str: profile.id,
                            user_name: profile.username || '',
                            display_name: profile.displayName || '',
                            profile_photo: profilePhoto,
                            location,
                            token,
                            token_secret: tokenSecret,
                        }, (err, doc) => {
                            if(err) {
                                console.log(err);
                                return done(null);
                            }

                            sessionObj.account_id = doc._id.toString();
                            req.session.social.twitter = sessionObj;
                            _emitter.emit('twitter_connected', sessionObj);

                            done(null, {twitter: {}});
                        });
                    }
                    else {
                        new _schema('system.accounts').init(app).put(account._id.toString(), {
                            user_name: profile.username,
                            display_name: profile.displayName,
                            profile_photo: profilePhoto,
                            location,
                            token,
                            token_secret: tokenSecret
                        }, (err, affected) => {
                            if(err)
                                console.log(err);
                            
                            sessionObj.account_id = account._id.toString();
                            req.session.social.twitter = sessionObj;
                            _emitter.emit('twitter_connected', sessionObj);

                            done(null, {twitter: {}});
                        });
                    }
                });
            });
        }));

        app.get('/api/:project/auth/twitter', passport.authenticate('twitter'));

        app.get('/api/:project/twitter/callback', passport.authenticate('twitter', {
            successRedirect: twitter.success,
            failureRedirect: twitter.failure
        }));

    });

};