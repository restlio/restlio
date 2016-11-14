class Field {

    constructor(app, field, object, cb) {
        this.render(app, field, object, cb);
    }

    /**
     * @TODO
     * config'e bağla
     */

    render(app, field, object, cb) {
        app.render(`admin/form/field/${field}`, object, (err, html) => {
            cb(err, html);
        });
    }
    
}

module.exports = app => Field;