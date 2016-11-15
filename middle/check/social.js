const Validator = require('validatorjs');
const request   = require('request');
const dot       = require('dotty');
const _         = require('underscore');

function CheckSocial(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _schema = _app.lib.schema;
    const _r      = _app.lib.request;
    const _middle = 'middle.check.social';
    
    // params
    const network = req.body.social_network;
    const token   = req.body.access_token;
    const secret  = req.body.token_secret;
    
    // data
    const data = {
        social_network : network,
        access_token   : token,
        token_secret   : secret
    };

    // validation rules
    const rules = {
        social_network : 'in:github,twitter,facebook,googleplus|required',
        access_token   : 'required'
    };

    if(network == 'twitter')
        rules.token_secret = 'required';
    
    // validate data
    const validation = new Validator(data, rules);

    if(validation.fails()) {
        return next( _resp.UnprocessableEntity({
            middleware: _middle,
            type: 'ValidationError',
            errors: validation.errors.all()
        }));
    }

    const endpoints = {
        github     : 'https://api.github.com/user?access_token=:access_token',
        twitter    : 'https://api.twitter.com/1.1/account/verify_credentials.json',
	    facebook   : 'https://graph.facebook.com/v2.7/me?fields=id,timezone,gender,hometown,name,email&access_token=:access_token',
        googleplus : 'https://www.googleapis.com/plus/v1/people/me?access_token=:access_token'
    };

    const emails = {
        github  : 'https://api.github.com/user/emails?access_token=:access_token',
        twitter : 'https://api.twitter.com/1.1/account/verify_credentials.json'
    };

    const _headers = {'User-Agent': 'Restlio'};
    let endpoint = endpoints[network];
    endpoint     = endpoint.replace(/:access_token/g, token);

	// control vars
	const _email    = req.body.email;
	const _username = req.body.username;
	
    if(network == 'github') {
        new _r().get(network, endpoint, {}, _headers).exec((err, results) => {

            if(dot.get(results, `${network}.code`) == 200) {
                const body     = dot.get(results, `${network}.body`) || {};
                const email    = body.email;
                const username = body.login;

                // eğer verdiği parametrelerle sosyal ağ bilgileri uyuşmuyorsa kontrol et
                if( _email != email && _username != username ) {
                    // check from user/emails
                    let userMails = emails.github.replace(/:access_token/g, token);
                    new _r().get(network, userMails, {}, _headers).exec((err, results) => {
                        userMails = dot.get(results, `${network}.body`);
                        let error = false;

                        if( ! userMails || Object.prototype.toString.call(userMails) != '[object Array]' || ! userMails.length )
                            error = 'not found user/emails';

                        const mails = _.map(userMails, obj => obj.email);

                        if(!mails.includes(_email))
                            error = 'check your email';

                        if(error) {
                            return next( _resp.Unauthorized({
                                middleware: _middle,
                                type: 'InvalidCredentials',
                                errors: [error]}
                            ));
                        }
                        else {
                            req.__social = {email, user: username, name: body.name || username};
                            return next();
                        }
                    });
                }
                // email ve username eşleşiyorsa datayı set et
                else {
                    req.__social = {email, user: username, name: body.name || username};
                    return next();
                }
            }
            // eğer code 200 dönmediyse hata at
            else {
                next( _resp.Unauthorized({
                    middleware: _middle,
                    type: 'InvalidCredentials',
                    errors: ['check social network credentials']}
                ));
            }
        });        
    }
    else if(network == 'twitter') {
        const consumer = dot.get(_app.config, `${_env}.social.${req.__appData.slug}.twitter.consumer`);
        
        if( ! consumer ) {
            return next( _resp.Unauthorized({
                middleware: _middle,
                type: 'InvalidCredentials',
                errors: ['twitter consumer config not found']}
            ));
        }

        const oauth = {
            consumer_key: consumer.key,
            consumer_secret: consumer.secret,
            token,
            token_secret: secret
        };
        
        request.get({url: endpoint, oauth, json:true}, (err, response, user) => {
            const id = dot.get(user, 'id');
            
            if( ! id ) {
                return next( _resp.Unauthorized({
                    middleware: _middle,
                    type: 'InvalidCredentials',
                    errors: ['check social network credentials']}
                ));
            }

            req.__social = {email: _email, user: _username, name: dot.get(user, 'name') || _username};
            return next();
        });
    }
    else if(network == 'facebook') {
	    // replace user id
	    new _r().get(network, endpoint, {}, _headers).exec((err, results) => {
	        const body = dot.get(results, `${network}.body`) || {};
		    
		    if( ! body.id || ! body.email ) {
			    return next( _resp.Unauthorized({
				    middleware: _middle,
				    type: 'InvalidCredentials',
				    errors: ['check social network credentials']}
			    ));
		    }

		    // check and set username
		    if( ! _username )
		        req.body.username = `F${body.id}`;
		    
		    const accountObj = {
			    type: 'F',
			    user_id: parseInt(body.id),
			    user_id_str: body.id,
			    user_name: body.username || '',
			    display_name: body.name || '',
			    profile_photo: `https://graph.facebook.com/${body.id}/picture?type=large`,
			    timezone: body.timezone || 0,
				gender: body.gender || '',   
			    token: data.access_token,
			    refresh_token: data.refresh_token || '',
		    };
		    
		    req.__social = {email: body.email, name: body.name, account: accountObj};
		    return next();
	    });
    }
	else if(network == 'googleplus') {
		// replace user id
		new _r().get(network, endpoint, {}, _headers).exec((err, results) => {
			const body = dot.get(results, `${network}.body`) || {};

			if( ! body.id || ! body.emails ) {
				return next( _resp.Unauthorized({
					middleware: _middle,
					type: 'InvalidCredentials',
					errors: ['check social network credentials']}
				));
			}

			// check emails 
			const mails = _.map(body.emails, obj => obj.value);
			if(!mails.includes(_email)) {
				return next( _resp.Unauthorized({
					middleware: _middle,
					type: 'InvalidCredentials',
					errors: ['check your email']}
				));
			}
			
			// check and set username
			if( ! _username )
				req.body.username = `GP${body.id}`;

			let photo = dot.get(body, 'image.url') || '';
			if(photo) photo = photo.replace('?sz=50', '');
			
			const accountObj = {
				type: 'GP',
				user_id: parseInt(body.id),
				user_id_str: body.id,
				user_name: body.username || '',
				display_name: body.displayName || '',
				profile_photo: photo,
				timezone: body.timezone || 0,
				gender: body.gender || '',
				token: data.access_token,
				refresh_token: data.refresh_token || '',
				id_token: data.id_token || '',
			};

			req.__social = {email: _email, name: body.displayName, account: accountObj};
			return next();
		});
	}
}

module.exports = app => CheckSocial;