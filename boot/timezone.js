const moment = require('moment-timezone');

module.exports = app => {

    const _conf = app.lib.bootConf(app, 'timezone');
    
    app.all('*', (req, res, next) => {
        if( req.session && ! req.session.time && _conf && _conf.default )
            req.session.time = {name: _conf.default};

        req.__time = false;
        
        if(req.session.time) {
            const currTz = moment.tz(req.session.time.name);
            const hours  = currTz.format('Z');
            const mins   = currTz.zone();
            
            req.session.time.hours = hours;
            req.session.time.mins  = mins;
                    
            req.__time = {
                name: req.session.time.name,
                hours,
                mins
            };                
        }
        
        next();
    });

    return true;

};




