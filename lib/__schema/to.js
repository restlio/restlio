const moment = require('moment-timezone');
const dot = require('dotty');
const php = require('phpjs');
const _ = require('underscore');

function To(obj, keepEmpty = false) {
    const self = this;

    _.each(obj, (value, key) => {
        // boş değerleri uçuruyoruz
        // aksi halde optional = true olan field'lar için type hatası veriyor
        if(php.empty(value) && ! keepEmpty ) {
            return delete obj[key];
        }

        // change alias with key
        const realKey = self._alias[key] || key; // alias'ın gerçek key karşılığını alıyoruz (field_one => pf.fo gibi)
        const props = dot.get(self._save, `properties.${realKey}`) || // standart object properties
                      dot.get(self._save, `properties.${realKey.replace('.', '.properties.')}`); // nested object properties

        if(self._dateFormat && props) {
            const dateFormat = dot.get(props, 'settings.dateFormat');
            const ftype = dot.get(props, 'settings.field') || props.ftype;
            let date;

            if(ftype === 'date' && dateFormat) {
                dot.put(obj, realKey, moment(value, dateFormat).toISOString());
            } else if(ftype === 'datetime') {
                date = self._time ? moment.tz(value, dateFormat, self._time.name) : moment(value, dateFormat);
                dot.put(obj, realKey, date.toISOString());
            }
        }
        
        if( ! self._alias[key] ) {
            return false;
        }

        // obje'den alias'ı uçuruyoruz
        delete obj[key];

        // gerçek key'i obje'ye yazıyoruz
        dot.put(obj, realKey, value);

        // eğer value "array of objects" şeklinde geldiyse obje'lerin herbirini self.to'dan geçiriyoruz
        if(self.type(value) === '[object Array]') {
            _.each(value, (aVal) => {
                if(self.type(aVal) === '[object Object]') {
                    self.to(aVal);
                }
            });
        }

        return false;
    });

    return this;
}

module.exports = To;
