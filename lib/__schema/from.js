const dot = require('dotty');
const _ = require('underscore');

function From(doc, name, parent, parentDoc, parentAlias, parentKey) {
    const self = this;
    const model = name ? this.getModel(name) : this._model;
    name = name || this._name;

    // inspector vars
    const keyAlias = model.schema.inspector.KeyAlias;
    const save = model.schema.inspector.Save;

    _.each(doc, (value, key) => {
        // _id key'ine ve materialized ile ilgili key'lere dokunma
        if(['_id', 'parentId', 'path', 'depth'].includes(key)) {
            return;
        }

        // remove hidden fields
        if(key[0] === '_' || key === 'id') {
            delete doc[key];
            return;
        }
            
        // original key
        const org = key;

        // parent key varsa orjinal key ile birleştir
        if(parent) {
            key = `${parent}.${key}`;
        }

        let props = false;
        let alias = false;
        let refs = false;
        let remove = false;

        // change key with alias
        if(key === 'children') {
            props = true;
            alias = 'children';
            refs = name;
            remove = false; // alias ile değiştiremediğimiz için silmiyoruz
        } else {
            // sıralama terse çevrildi, ilk sırada "standart object" props olunca nested objelere erişemiyor
            props = dot.get(save, `properties.${key.replace('.', '.items.properties.')}`) ||  // "array of objects" props
                    dot.get(save, `properties.${key.replace('.', '.properties.')}`) || // "nested object" props
                    dot.get(save, `properties.${key}`); // "standart object" props

            refs = self._refs[key];

             // FIXME:
             // "array of objects" te parent olarak key gönderildiğinde
             // buradaki key ctn.i gibi dot notation key oluyor,
             // bunun "save" değişkeninde karşılığı olmuyor
            
            if(props) {
                alias = props.alias;
            }

            // alias ve key birbirinden farklıysa obje'den uçur
            remove = (alias !== key);
        }

        if( ! props ) {
            return;
        }

        // check denormalized field
        const from = dot.get(save, `properties.${key}.from`);
        if(from) {
            _.each(value, (fval) => self.from(fval, from));
        }

        // get value type
        const vType = self.type(value);

        // replace options values
        if(dot.get(props, 'settings.options')) {
            for(let o in props.settings.options) {
                const curr = props.settings.options[o];

                // TODO: [object Array] için de orjinal değeri göster
                if(vType === '[object Array]') {
                    for(let v in value) {
                        if(value[v] === curr.value) {
                            value[v] = curr.label;
                            break;
                        }
                    }
                } else if(value === curr.value) {
                    dot.put(doc, `${alias}_v`, value); // show original value
                    value = curr.label;
                    break;
                }
            }
        }

        // doc[alias] a eşitleyeceğimiz değeri klonluyoruz
        // klonlamazsak objelerin referansı yüzünden sıkıntı çıkıyor
        // (not: _.clone populate edilmeyen object id'leri bozuyor)
        value = refs ? JSON.parse(JSON.stringify(value)) : value;

        // change key with alias
        if(alias) {
            doc[alias] = value;
        }

        // check dynamic reference
        const dynamic = dot.get(model.schema, `paths.${org}.options.refPath`);

        if(dynamic) {
            if(doc[dynamic]) refs = doc[dynamic];
            else if(keyAlias[dynamic]) refs = doc[keyAlias[dynamic]];
        }

        // get refs for subpopulated document
        refs = refs ||
               dot.get(model.schema, `paths.${org}.options.ref`) ||
               dot.get(model.schema, `paths.${org}.caster.options.ref`);

        // populate fields
        if(refs) {
            if(vType === '[object Array]') {
                _.each(value, (refval, refkey) => {
                    if(refval && refval._id) { // sonuçlar populate edilmediyse çevrim yapmıyoruz
                        self.from(refval, refs, null, doc, alias, refkey); // parent = null
                    }
                });
            } else if(vType === '[object Object]' && value._id) { // sonuçlar populate edilmediyse çevrim yapmıyoruz
                self.from(value, refs, null, doc, alias); // parent = null
            }
        } else if(vType === '[object Object]') { // process "nested object"
            self.from(value, null, key);
        } else if(vType === '[object Array]') { // process "array of objects"
            _.each(value, (aVal) => {
                if(self.type(aVal) === '[object Object]') {
                    // array of objects'te değer olarak ObjectId olduğunda
                    // express json stringify hatası atıyor, ObjectId'yi string'e çeviriyoruz
                    // TODO: değer olarak [ObjectIds] gelmesi durumunda kontrol et
                    aVal = _.mapObject(aVal, (val) => (self.type(val) === '[object Object]') ? val.toString() : val);
                    self.from(aVal, null, key);
                }
            });
        }

        // remove original key
        if(remove) delete doc[org];
    });

    // run mask for populated fields
    if(parentDoc) {
        if (typeof parentKey !== 'undefined') {
            parentDoc[parentAlias][parentKey] = self.maskOne('get', doc, name);
        } else {
            parentDoc[parentAlias] = self.maskOne('get', doc, name);
        }
    }
}

module.exports = From;
