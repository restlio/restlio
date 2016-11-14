const feedparser = require('feedparser');
const request    = require('request');
const async      = require('async');
const read       = require('node-read');
const dot        = require('dotty');
const he         = require('he');
const _          = require('underscore');
_.s              = require('underscore.string');

class FeedParser {

    constructor(app) {
        this._app        = app;
        this._env        = app.get('env');
        this._log        = app.lib.logger;
        this._schema     = app.lib.schema;
        this._done       = null;
        this._redis      = app.core.redis.a;
        this._mongoose   = app.core.mongo.mongoose;
        this._config     = app.config[this._env].feed;
        this._group      = 'FEEDPARSER';
        this._gramophone = app.lib.gramophone;
        this._emitter    = app.lib.schemaEmitter;
        
        const stopwords    = app.config[this._env].stopwords;
        this._stopwords  = stopwords.tr.concat(stopwords.en);
        
        return this;
    }

    run(channelId, done) {
        const self   = this;
        this._done = done;
        
        new this._schema('feed.channels').init(this._app).getById(channelId, (err, channel) => {
            if(err) {
                self._log.error(group, err);
                return done();
            }
            
            if( ! channel ) {
                self._log.error(group, 'channel not found');
                return done();
            }

            if( ! channel.url ) {
                self._log.error(group, 'channel url not found');
                return done();
            }

            self.parse(channel);
        });
    }

    parse(channel) {
        const self   = this;
        const req    = request(channel.url);
        const parser = new feedparser();
        const group  = `${this._group}:PARSE`;

        req.on('error', error => {
            self._log.error(group, error);
            self._done();
        });

        req.on('response', function (res) {
            const stream = this;

            if (res.statusCode != 200) {
                self._log.error(group, 'bad status code');
                return self._done();
            }

            stream.pipe(parser);
        });

        parser.on('error', error => {
            self._log.error(group, error);
            self._done();
        });

        // job done!
        parser.on('end', () => {
            console.log('---------- parser end ----------');
            self._done();
        });

        parser.on('readable', function() {
            const stream = this;
            const meta = this.meta;
            let item;

            while (item = stream.read()) {
                self.item(item, channel);
            }
        });
    }

    item(item, channel) {
        const self     = this;
        const itemurl  = item.origlink || item.link;
        const itemkey  = `read:url:${itemurl}`;
        const appkey   = `read:url:${itemurl}:${channel.apps}`;
        let terms      = null;
        const termsArr = [];
        const group    = `${this._group}:ITEM`;
        const a        = {};
        
        // get term list
        termsArr.push(item.title);
        
        // get summary
        const summary = item.summary || item.description;
        
        if(summary)
            termsArr.push(_.s.stripTags(summary));

        a.itemKey = cb => {
            self._redis.get(itemkey, (err, parsed) => {
                cb(null, parsed);
            });
        };
        
        a.appKey = cb => {
            self._redis.get(appkey, (err, parsed) => {
                cb(null, parsed);
            });
        };

        async.parallel(a, (err, results) => {
            const itemParsed = parseInt(results.itemKey);
            const appParsed  = parseInt(results.appKey);

            // eğer parse edilmiş olarak işaretlendiyse bir daha parse etmiyoruz
            if(appParsed)
                return self._log.info(group, 'app item found!');

            if(itemParsed) {
                self.pushData(appkey, itemurl, channel);
                return self._log.info(group, 'item found!');
            }
            
            if(self._config.readability) {
                // get item page
                request.get(itemurl, (err, response, body) => {
                    if(err)
                        return self._log.error(group, err);

                    if( ! body )
                        return self._log.error(group, 'body not found');

                    read(body, (err, article, res) => {
                        if(err)
                            return self._log.error(group, err);

                        if( ! article )
                            return self._log.error(group, 'article not found!');

                        // set article terms
                        if(article.content)
                            termsArr.push(_.s.stripTags(article.content));

                        terms = self.terms(item, termsArr);
                        self.saveContent(appkey, itemkey, itemurl, item, channel, terms, article.content);
                    });
                });
            }
            else {
                terms = self.terms(item, termsArr);
                self.saveContent(appkey, itemkey, itemurl, item, channel, terms);
            }
        });
    }

    pushData(appkey, url, channel, cb) {
        const Content = this._mongoose.model('Feed_Contents');
        const self    = this;
        const group   = `${this._group}:PUSHDATA`;
        
        // set update
        const obj = {ci: channel._id};

        if(channel.apps)
            obj.ap = channel.apps;

        if(channel.sources)
            obj.so = channel.sources;
        
        if(channel.categories && channel.categories.length)
            obj.ct = {$each: channel.categories};
        
        Content.update({u: url}, {$addToSet: obj}, (err, raw) => {
            if(err)
                self._log.error(group, err);
            
            if(raw && raw.nModified) {
                Content.findOne({u: url}, (err, doc) => {
                    if(doc) {
                        doc.save(err => {
                            if( ! err ) {
                                self._redis.set(appkey, 1);
                                self._redis.expire(appkey, 7*86400); // 7 days expire                            
                            }

                            // emit feed content event
                            self._emitter.emit('feed_contents_saved', {
                                source: 'Feed_Contents',
                                doc
                            });
                            
                            if(cb) cb(err);
                        });                    
                    }
                    else if(cb) cb(err);
                });            
            }
            else if(cb) cb(err);
        });
        
    }

    terms(item, termsArr) {
        let content = he.decode(termsArr.join(' '));
        content     = content.replace(/'.[^]/g,' '); // remove after apostrophe
        content     = content.replace(/‘.[^]/g,' '); // remove after apostrophe
        content     = content.replace(/’.[^]/g,' '); // remove after apostrophe
        content     = content.replace(/[“”‘’.,-\/#!$%\^&\*;:{}=\-_`~()]/g, ' '); // remove punctation
        content     = content.replace(/(^| ).( |$)/g,''); // remove single character
        
        // extract terms
        const terms = this._gramophone.extract(content, {
            html: true,
            limit: 500,
            min: 3,
            score: true,
            stem: false,
            ngrams: [1, 2],
            stopWords: this._stopwords
        });
        
        // reset vars
        termsArr = null;

        // get terms
        let termList = _.map(terms, obj => obj.term);

        // tag search'te gelebilmesi için term'leri parçala
        _.each(termList, (value, key) => {
            value = value.split(' ');

            if(value.length > 1)
                termList = value.concat(termList);
        });

        termList = item.categories.concat(termList);
        termList = _.map(termList, term => term.toLowerCase());
        termList = _.uniq(termList);

        // tek karakterli term'leri alma
        termList = _.reject(termList, val => val.length <= 2);

        return {terms, list: termList};
    }

    saveContent(appkey, itemkey, itemurl, item, channel, terms, content) {
        const self  = this;
        const group = `${this._group}:SAVE_CONTENT`;
        const body  = {
            title        : item.title,
            type         : 'R',
            url          : itemurl,
            summary      : _.s.stripTags(item.summary),
            thumbnail    : item.image.url,
            published_at : item.date,
            tags         : item.categories,
            terms        : terms.list
        };
            
        if(content)
            body.content = content;

        new this._schema('feed.contents').init(this._app).post(body, (err, content) => {
            if(err) {
                self._log.error(group, err);
                return self._done();
            }

            if( ! content ) {
                self._log.error(group, 'content not saved!');
                return self._done();
            }

            if(self._app.boot.shortener) {
                const shortURLPromise = self._app.boot.shortener.generate({
                    URL: itemurl
                });

                shortURLPromise.then(mongodbDoc => {
                    if(mongodbDoc && mongodbDoc.hash)
                        new self._schema('feed.contents').init(self._app).put(content._id.toString(), {shortener: mongodbDoc.hash}, (err, raw) => {});
                }, error => {
                    if(error)
                        self._log.error(group, error);
                });
            }
            
            // set redis key for url
            self._redis.set(itemkey, 1);
            self._redis.expire(itemkey, 7*86400); // 7 days expire
            self.saveTerms(content, terms, channel, channel.source);
            self.pushData(appkey, itemurl, channel);
        });
    }

    saveTerms(content, terms, channel, source) {
        const self     = this;
        const group    = `${this._group}:SAVE_TERMS`;
        const keywords = new this._schema('feed.keywords').init(this._app);

        _.each(terms.terms, (value, key) => {
            if(value && value.term.length <= 2)
                return;

            const body = {
                term     : value.term.toLowerCase(),
                freq     : value.tf,
                contents : content._id,
                channels : channel._id
            };
            
            if(source)
                body.sources = source;
            
            if(channel.source)
                body.sources = channel.source;

            keywords.post(body, (err, content) => {
                if(err)
                    self._log.error(group, err);
            });
        });
    }

}

module.exports = app => FeedParser;
