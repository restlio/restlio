class Mailer {

    constructor(transport) {
        this._transport = transport;
        return this;
    }

    send(opts, cb) {
        if( ! this._transport ) {
            console.log('mailer.send transport not found');

            if(cb)
                return cb(true);
            else
                return false;
        }

        if(opts.logTransport)
            console.log(this._transport.transporter);
        
        this._transport.sendMail(opts, (err, info) => {
            if(cb) {
                console.log('mailer.send callback found');

                if(err)
                    console.log(err);

                return cb(err, info);
            }

            if(err)
                return console.log(err);

            console.log(`Message sent: ${info.response}`);
        });
    }
    
}

module.exports = app => Mailer;


