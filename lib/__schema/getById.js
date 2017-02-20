function GetById(id, cb) {
    const self = this;
    const Item = self._model;
    const cond = {_id: id}; // where conditions

    // set app id for system objects (before Item.findOne)
    if(this._appId) cond.ap = this._appId;

    // set acl owner protection (api response ise owner protection uygula)
    if( ! this._master && this.protect('getid') ) {
        const alias = this._owner.alias;
        const field = this._alias[alias];
        cond[field] = this._user;
    }

    Item.findOne(cond, (err, doc) => {
        if(err) {
            return self.errors(err, cb);
        }

        if( ! doc ) {
            return self.errors({name: 'NotFound'}, cb);
        }

        if(doc && self._format) {
            doc = doc.toJSON();
            self.from(doc);
            doc = self.maskOne('get', doc);
        }

        return cb ? cb(null, doc) : self._http.OK({doc}, self._res);
    });
}

module.exports = GetById;
