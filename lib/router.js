class Router {

    constructor() {
        this.isListening = false;
        this.routes      = [];
        this.nsps        = [];
    }

    add(namespace, route, cb) {
        if(this.isListening)
            throw Error('app.io socket is listening');

        if( ! cb ) {
            cb        = route;
            route     = namespace;
            namespace = '/';
        }

        if(typeof namespace !== 'string' || typeof route !== 'string' || typeof cb !== 'function')
            throw Error('app.io socket route argument error');

        this.routes.push({namespace, route, fn: cb});

        if(!this.nsps.includes(namespace))
            this.nsps.push(namespace);
    }

    addListeners(io) {
        for(let i = 0; i < this.nsps.length; i++) {

            (((i, self) => {
                io.of(self.nsps[i]).on('connection', s => {
                    self.listen(self.nsps[i], s);
                });
            }))(i, this);

        }

        this.isListening = true;
    }

    listen(namespace, socket) {
        for(let i = 0; i < this.routes.length; i++) {

            if(this.routes[i].namespace !== namespace)
                continue;

            (((i, self) => {
                socket.on(self.routes[i].route, data => {
                    self.routes[i].fn(socket, data);
                });
            }))(i, this);
        }
    }
    
}

module.exports = app => Router;
