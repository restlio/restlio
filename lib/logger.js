class Logger {

    constructor(app) {
        this._app = app;
        this._log = this._app.system.logger;
        this._test = this._app.get('istest');
        
        this._colors = {
            white   : '\u001b[37m',
            grey    : '\u001b[90m',
            gray    : '\u001b[90m',
            black   : '\u001b[30m',
            blue    : '\u001b[34m',
            cyan    : '\u001b[36m',
            green   : '\u001b[32m',
            magenta : '\u001b[35m',
            red     : '\u001b[31m',
            yellow  : '\u001b[33m',
            reset   : '\u001b[0m',
        };

        this._styles = {
            blink     : '\u001b[49;5;8m',
            underline : '\u001b[4m',
            bold      : '\u001b[1m',
        };

        this._backgrounds = {
            white   : '\u001b[47m',
            black   : '\u001b[40m',
            blue    : '\u001b[44m',
            cyan    : '\u001b[46m',
            green   : '\u001b[42m',
            magenta : '\u001b[45m',
            red     : '\u001b[41m',
            yellow  : '\u001b[43m',
        };

        this._seperator =
            `${this._colors.grey}---------------------------------------------------------------------\n${this._colors.reset}`;

        return this;
    }

    info(group, message, color) {
        if(this._test) return;
        // message = message ? JSON.parse(JSON.stringify(message)) : message;
        // color = this._colors[color] || this._colors.green;
        // group = `${this._seperator+this._backgrounds.white+color}[ ${group} ]${this._colors.reset}`;
        this._log.info(group, message);
    }

    error(group, error) {
        if(this._test) return;
        // group = `${this._seperator+this._backgrounds.white+this._colors.red}[ ${group} ]${this._colors.reset}`;
        this._log.error(group, error);
    }

    schema(group, message, api) {
        if(this._test) return;
        // message = message ? JSON.parse(JSON.stringify(message)) : message;
        // const color = api ? this._colors.blue : this._colors.cyan;
        // group = `${this._seperator+this._backgrounds.white+color}[ ${group} ]${this._colors.reset}`;
        this._log.info(group, message);
    }

    middle(group, message) {
        if(this._test) return;
        // message = message ? JSON.parse(JSON.stringify(message)) : message;
        // group = `${this._seperator+this._backgrounds.white+this._colors.magenta}[ ${group} ]${this._colors.reset}`;
        this._log.info(group, message);
    }

    instance(group, message) {
        if(this._test) return;
        message = message ? JSON.parse(JSON.stringify(message)) : message;
        
        const logo =
        '\n\n\n\n\n'+
        '   .---------------------------.\n'+
        '   |                           |\n'+
        '   |          Restlio          |\n'+
        '   |                           |\n'+
        '   \'---------------------------\'\n\n';
        this._log.info(`${this._colors.cyan+logo+this._seperator+this._backgrounds.black+this._colors.white}[ ${group} ]${this._colors.reset}`, message);
    }
    
}

module.exports = app => new Logger(app);

