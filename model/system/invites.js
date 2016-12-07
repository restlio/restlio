const async = require('async');
const php   = require('phpjs');
const dot   = require('dotty');
const _     = require('underscore');

module.exports = app => {

    const _env      = app.get('env');
    const _log      = app.lib.logger;
    const _conf     = app.config[_env];
    const _mongoose = app.core.mongo.mongoose;
    const _query    = app.lib.query;
    const _emitter  = app.lib.schemaEmitter;
    const _mailer   = app.lib.mailer;
    const _group    = 'MODEL:system.invites';

    // types
    const ObjectId  = _mongoose.Schema.Types.ObjectId;
    const Mixed     = _mongoose.Schema.Types.Mixed;

    /**
     * ----------------------------------------------------------------
     * Schema
     * ----------------------------------------------------------------
     */

    const Schema = {
        ap  : {type: ObjectId, required: true, ref: 'System_Apps', alias: 'apps'},
        em  : {type: String, required: true, alias: 'email', pattern: 'email', index: true},
        ir  : {type: ObjectId, ref: 'System_Users', alias: 'inviter', index: true},
        na  : {type: String, alias: 'name'},
        ca  : {type: Date, alias: 'created_at', default: Date.now},
        it  : {type: String, required: true, alias: 'invite_token', index: true},
        iex : {type: Date, required: true, alias: 'invite_expires'},
        dt  : {type: String, required: true, alias: 'detail'},
        es  : {type: String, default: 'Y', enum: ['Y', 'N'], alias: 'email_sent', index: true},
        st  : {type: String, default: 'AC', enum: ['WA', 'AC', 'DC'], alias: 'status', index: true}
    };

    /**
     * ----------------------------------------------------------------
     * Settings
     * ----------------------------------------------------------------
     */

    Schema.st.settings = {
        options: [
            {label: 'Waiting', value: 'WA'},
            {label: 'Accepted', value: 'AC'},
            {label: 'Declined', value: 'DC'}
        ]
    };

    /**
     * ----------------------------------------------------------------
     * Load Schema
     * ----------------------------------------------------------------
     */

    const InviteSchema = app.libpost.model.loader.mongoose(Schema, {
        Name: 'System_Invites',
        Options: {
            singular : 'System Invite',
            plural   : 'System Invites',
            columns  : ['email'],
            main     : 'email',
            perpage  : 25
        },
        Owner: {
            field : 'ir',
            alias : 'inviter',
            protect : {
                'get': true,
                'getid': true,
                'post': true,
                'put': true
            }
        }
    });

    // plugins
    InviteSchema.plugin(_query);

    // compound index
    InviteSchema.index({ap: 1, em: 1}, {unique: true});

    /**
     * ----------------------------------------------------------------
     * Pre Save Hook
     * ----------------------------------------------------------------
     */

    InviteSchema.pre('save', function(next) {

        const self = this;
        self._isNew = self.isNew;
        next();

    });

    /**
     * ----------------------------------------------------------------
     * Post Save Hook
     * ----------------------------------------------------------------
     */

    InviteSchema.post('save', function(doc) {

        // eğer app için invite moderation aktif ise status değişimine bak, onaylandıysa mail at
        if( ! this._isNew ) {

            // get app data
            const Apps = _mongoose.model('System_Apps');

            Apps.findById(doc.ap, (err, apps) => {
                if( err || ! apps )
                    return _log.info(_group, 'not found app data for system.invites');

                const slug     = apps.s;
                const moderate = dot.get(_conf, `app.config.${slug}.auth.invite_moderation`) ||
                                 dot.get(_conf, `auth.${slug}.auth.invite_moderation`);

                if(moderate && doc.es == 'N' && doc.st == 'AC' && doc.it && doc.em) {
                    const mailConf = dot.get(_conf, `app.mail.${slug}`) ||
                                   dot.get(_conf, `mail.${slug}`);

                    if(mailConf) {
                        const mailObj = _.clone(mailConf.invite);

                        app.render('email/templates/invite', {
                            baseUrl: mailConf.baseUrl,
                            endpoint: mailConf.endpoints.invite,
                            token: doc.it
                        }, (err, html) => {
                            if(err)
                                _log.error(_group, err);

                            if(html) {
                                mailObj.to   = doc.em;
                                mailObj.html = html;

                                _log.info(`${_group}:MAIL_OBJ`, mailObj);

                                const _transport = app.boot.mailer;
                                new _mailer(_transport).send(mailObj);
                            }
                        });

                        // flag invitation as "sent"
                        doc.es = 'Y';
                        doc.save(err => {
                            if(err)
                                _log.error(_group, err);
                        });
                    }
                    else
                        _log.info(`${_group}:MAIL_OBJ`, 'not found');
                }
            });
        }

    });

    return _mongoose.model('System_Invites', InviteSchema);

};



