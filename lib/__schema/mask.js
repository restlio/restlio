const _ = require('underscore');

exports.getMaskFields = function getMaskFields(type, model) {
    let fields = false;
    let _mask = this._mask;
    let _model;
    let _owner;

    if(model) {
        _model = this.getModel(model);
        _mask = _model.schema.inspector.Mask;
        _owner = _model.schema.inspector.Owner;
    }

    // api request'lerine mask uygulanacak
    if(this._api && this._app.lib.utils && _mask && _mask[type]) {
        const mask = _mask[type];

        if(this._master) {
            fields = mask.master || mask.owner || mask.user || mask.guest;
            this.log('MASK:TYPE', 'master');
        } else if(this.protect(type, _owner)) {
            fields = mask.owner || mask.user || mask.guest;
            this.log('MASK:TYPE', 'owner');
        } else if(this._user && this._user !== 'guest') {
            fields = mask.user || mask.guest;
            this.log('MASK:TYPE', 'user');
        } else {
            fields = mask.guest;
            this.log('MASK:TYPE', 'guest');
        }
    }

    return fields;
};

// execute json masking
exports.mask = function mask(type, doc) {
    const self = this;
    const fields = this.getMaskFields(type);

    if(fields) {
        _.each(doc, (value, key) => {
            doc[key] = self._app.lib.utils.helper.mask(value, fields);
        });
    }
};

// execute json masking for one document
exports.maskOne = function maskOne(type, doc, model) {
    const fields = this.getMaskFields(type, model);

    // change doc
    if(fields) {
        return this._app.lib.utils.helper.mask(doc, fields);
    }
    
    return doc;
};
