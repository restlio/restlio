const passport = require('passport');
const strategy = require('passport-foursquare').Strategy;
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
    const _group   = 'AUTH:SOCIAL:FOURSQUARE';

    /**
     * init passport foursquare
     */

    _.each(_conf, (value, key) => {
        const project = key;

        if( ! value.foursquare || ! value.foursquare.enable )
            return;

        const foursquare = value.foursquare;

        passport.use(new strategy({
            clientID: foursquare.key,
            clientSecret: foursquare.secret,
            callbackURL: foursquare.callback,
            passReqToCallback : true
        },
        (req, token, tokenSecret, profile, done) => {
            const project = req.params.project;

            new _schema('system.apps').init(app).get({
                slug: project,
                qt: 'one'
            }, (err, apps) => {
                if(err) {
                    _log.info(_group, 'app not found');
                    return done(null);
                }

                profile = dot.get(profile, '_json.response.user');
                    
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
                    
                    // set display name
                    let displayName = '';
                    
                    if(profile.firstName) {
                        displayName += profile.firstName;
                        
                        if(profile.lastName)
                            displayName += ` ${profile.lastName}`;
                    }
                    
                    // set profile photo
                    let profilePhoto = '';
                    
                    if(profile.photo && profile.photo.prefix && profile.photo.suffix)
                        profilePhoto = `${profile.photo.prefix}original${profile.photo.suffix}`;

                    // set location
                    const location = profile.homeCity || '';
                    
                    const sessionObj   = {
                        network_id: parseInt(profile.id),
                        network_id_str: profile.id,
                        user_name: profile.id,
                        display_name: displayName,
                        profile_photo: profilePhoto,
                        location,
                        token
                    };
                    
                    if( ! account ) {
                        new _schema('system.accounts').init(app).post({
                            apps: apps._id.toString(),
                            type: 'FS',
                            user_id: parseInt(profile.id),
                            user_id_str: profile.id,
                            user_name: profile.id || '',
                            display_name: displayName,
                            profile_photo: profilePhoto,
                            location,
                            token
                        }, (err, doc) => {
                            if(err) {
                                console.log(err);
                                return done(null);
                            }

                            sessionObj.account_id = doc._id.toString();
                            req.session.social.foursquare = sessionObj;
                            _emitter.emit('foursquare_connected', sessionObj);

                            done(null, {foursquare: {}});
                        });
                    }
                    else {
                        new _schema('system.accounts').init(app).put(account._id.toString(), {
                            user_name: profile.id || '',
                            display_name: displayName,
                            profile_photo: profilePhoto,
                            location,
                            token
                        }, (err, affected) => {
                            sessionObj.account_id = account._id.toString();
                            req.session.social.foursquare = sessionObj;
                            _emitter.emit('foursquare_connected', sessionObj);

                            done(null, {foursquare: {}});
                        });
                    }
                });
            });
        }));

        app.get('/api/:project/auth/foursquare', passport.authenticate('foursquare'));

        app.get('/api/:project/foursquare/callback', passport.authenticate('foursquare', {
            successRedirect: foursquare.success,
            failureRedirect: foursquare.failure
        }));

    });

};