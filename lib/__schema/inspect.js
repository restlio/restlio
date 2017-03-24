const sanitize = require('sanitize-html');
const php = require('phpjs');
const dot = require('dotty');
const _ = require('underscore');

function Inspect() {
    const self = this;

    this.sanitize_html = function sanitizeHtml(schema, post) {
        if( typeof post === 'string' && // string'ler kontrol edilecek
            ! ['objectid', 'number', 'date'].includes(schema.ftype) && // objectid string bile gelse kontrol etme
            ! schema.eq // enum'lar için de kontrol etme
        ) {
            post = sanitize(post, dot.get(schema, 'settings.html') || {
                allowedTags: [],
                allowedAttributes: {},
            });
        }

        return post;
    };

    this.validate_empty = function validateEmpty(schema, candidate, cb) {
        // date objesi geldiyse kontrol etmiyoruz, yoksa empty olarak işaretliyor
        if(self.type(candidate) === '[object Date]') return cb();

        candidate = php.trim(candidate);
        if(typeof candidate === 'undefined' || php.empty(candidate)) {
            this.report('empty field', schema.code);
        }

        return cb();
    };

    this.validate_objectid = function validateObjectid(schema, candidate, cb) {
        const type = self.type(candidate);

        // update işleminde field tanımlanmadıysa bile bu kontrole giriyor
        // optional ve tanımlanmamış alan için kontrol etmiyoruz
        if(typeof candidate === 'undefined') return cb();

        // sanitize'dan [''] şeklinde geçen field'lar düzeltilecek
        else if(type === '[object Array]' && candidate.length && candidate[0] === '') return cb();

        const t = this;
        const m = self.getModel(schema.ref);

        if( ! m ) {
            t.report('non existing reference', schema.code);
            return cb();
        }

        self.log('OBJECTID', candidate);

        const i = (self.type(candidate) === '[object Array]') ? candidate : [candidate];
        const cond = {_id: {$in: i}};
        let belongs = false;
        
        // check belongs to
        if(schema.belongs_to) {
            const props = self._schema.properties;
            let belongsTo = _.where(props, {alias: schema.belongs_to.self});
            const origin = this.origin;
            const alias = m.schema.inspector.Alias;
            
            if(belongsTo.length) {
                belongsTo = belongsTo[0];
                cond[alias[schema.belongs_to.target]] = origin[belongsTo.fname];
                belongs = true;
            }
        }
        
        m.count(cond, (err, count) => {
            const uniq = _.uniq(i);
            if(count !== uniq.length && candidate) {
                if(belongs) t.report('non existing belongs_to id', schema.code);
                else t.report('non existing id', schema.code);
            }
            cb();
        });

        return false;
    };
}

module.exports = Inspect;
