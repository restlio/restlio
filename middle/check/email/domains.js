const addrs = require('email-addresses');
const dot   = require('dotty');

function CheckEmailDomains(req, res, next) {

    const _app    = req.app;
    const _env    = _app.get('env');
    const _resp   = _app.system.response.app;
    const _helper = _app.lib.utils.helper;
    const _middle = 'middle.check.email.domains';
    
    // mail conf
    const _appSlug  = req.__appData.slug;
    const _mailConf = dot.get(req.app.config[_env], `app.mail.${_appSlug}`) || 
                      dot.get(req.app.config[_env], `mail.${_appSlug}`);
    
    let _email = req.body.email;

    if(_mailConf &&
       _helper.type(_mailConf.domains) == '[object Array]' &&
       _mailConf.domains.length
    ) {
        if( ! _email || _email === '' ) {
            return next( _resp.Unauthorized({
                middleware: _middle,
                type: 'InvalidCredentials',
                errors: ['not found email']
            }));
        }

        _email = _email.toLowerCase();
        _email = addrs.parseOneAddress(_email);

        if( ! _email ) {
            return next( _resp.Unauthorized({
                middleware: _middle,
                type: 'InvalidCredentials',
                errors: ['not found email address']
            }));
        }

        if(!_mailConf.domains.includes(_email.domain)) {
            return next( _resp.Unauthorized({
                middleware: _middle,
                type: 'InvalidCredentials',
                errors: ['not allowed domain']
            }));
        }
    }

    next();

}

module.exports = app => CheckEmailDomains;