const dot = require('dotty');

function Remove(id, cb) {
    const self = this;
    const Item = this._model;
    const cond = {_id: id}; // where conditions

    // set app id for system objects (before Item.findOne)
    if(this._appId) cond.ap = this._appId;

    // set acl owner protection (api response ise owner protection uygula)
    if( ! this._master && this.protect('remove') ) {
        const alias = dot.get(this._owner, 'protect.remove.alias') || this._owner.alias;
        const field = this._alias[alias];
        cond[field] = this._user;
    }

    this.log('REMOVE:CONDITIONS', cond);
    
    Item.findOne(cond, (err, doc) => {
        if(err) return self.errors(err, cb);
        if( ! doc ) return self.errors({name: 'NotFound'}, cb);

        // soft delete
        if(self._schemaOpts.softdelete) {
            doc.ide = 'Y'; // use this field name for soft delete
            doc.save(err => {
                if(err) return self.errors(err, cb);
                return cb ? cb(null) : self._http.NoContent(null, self._res);
            });
        } else if(typeof Item.Remove === 'function') {
            // materialized'da children document'ları da silmesi için Remove fonksiyonunu kullan
            Item.Remove(cond, err => {
                if(err) return self.errors(err, cb);
                return cb ? cb(null) : self._http.NoContent(null, self._res);
            });
        } else {
            doc.remove(err => {
                if(err) return self.errors(err, cb);
                return cb ? cb(null) : self._http.NoContent(null, self._res);
            });
        }

        return false;
    });
}

module.exports = Remove;
