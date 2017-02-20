function Post(obj, cb) {
    obj = this.clone(obj);
    this.log('POST:DATA:NAKED', obj);
    
    // execute mask (obj'ye başka field'lar set edilmeden önce)
    obj = this.maskOne('post', obj);
    obj = obj || {}; // maskOne'dan null dönerse aşağıda hata atmasın
    this.log('POST:DATA:MASKED', obj);
    
    // set app id for system objects (before this.to)
    if(this._appId) obj.apps = this._appId;

    // set acl owner protection
    if(this.protect('post')) {
        const alias = this._owner.alias;
        // const field = this._alias[alias];
        const profile = this._owner.profile;

        if( ! this._master ) obj[alias] = this._user;
        // eğer master, owner user belirtmediyse kaydederken kendisini set ediyoruz
        else if( ! obj[alias] ) obj[alias] = this._user;

        // check profile id
        if(profile && this._profile) {
            if( ! this._master ) obj[profile.alias] = this._profile;
            // eğer master, owner profile belirtmediyse kaydederken kendisini set ediyoruz
            else if( ! obj[profile.alias] ) obj[profile.alias] = this._profile;
        }
    }

    // execute alias converting
    this.to(obj);
    this.log('POST:DATA:CONVERTED', obj);
    
    const self = this;
    
    this.validate(this._save, obj, (err, result) => {
        if(result.error.length) {
            return self.errors({name: 'ValidationError', errors: result.error}, cb);
        }

        const Item = new self._model(obj);

        Item.save((err2, doc) => {
            if(err2) return self.errors(err2, cb);

            if(doc && self._format) {
                doc = doc.toJSON();
                self.from(doc);
            }

            return cb ? cb(null, doc) : self._http.Created({doc}, self._res);
        });

        return false;
    });
}

module.exports = Post;
