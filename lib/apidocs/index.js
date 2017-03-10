const async = require('async');
const uuid = require('uuid');
const fs = require('fs');
const _ = require('underscore');
const debug = require('debug')('RESTLIO:API_DOCS');

class ApiDocs {

    constructor(app, cb) {
        this._app = app;
        this._cb = cb;
        this._doc = '';
        this._tmp = {};

        this.basic();
        this.postman();
        
        return this;
    }

    basic() {
        const self = this;

        async.parallel({
            endpoints(cb) {
                self._app.render(`${__dirname}/endpoints`, cb);
            },
            get_query(cb) {
                self._app.render(`${__dirname}/get_query`, cb);
            },
            put_query(cb) {
                self._app.render(`${__dirname}/put_query`, cb);
            },
        }, (err, results) => {
            // generate documentation
            self.credentials();
            self._doc += results.endpoints;
            self.generate();
            self._doc += results.get_query;
            self._doc += results.put_query;

            fs.writeFile(`${self._app.get('basedir')}/README.md`, self._doc, () => {
                debug('documentation file saved!');
            });

            self._cb(null, 'processing...');
        });
    }

    credentials() {
        const self = this;
        
        _.each(self._app.apidocs.config, (value) => {
            self._doc += `# ${value.name}\n\n`;
            
            _.each(value.env, (eValue) => {
                self._doc += `## ${eValue.apidocs.env}\n\n`;

                self._doc += '### Url\n';
                self._doc += `> **\`${eValue.apidocs.baseurl}\`**\n\n`;
                
                self._doc += '### API Credentials\n';
                self._doc += `> **\`Client Id\`** ${eValue.apidocs.client_id}  \n`;
                self._doc += `**\`Client Secret\`** ${eValue.apidocs.client_secret}  \n\n`;
            });
        });
    }

    generate() {
        const self = this;
        let hSys = false;
        let hApp = false;
        
        _.each(this._app.model, (value, key) => {
            // acl ve oauth modellerini dökümantasyona almıyoruz
            if(['acl', 'oauth'].includes(key)) return;

            // model type title
            if( ! hSys && key === 'system') {
                self._doc += '# API Endpoints [System]\n\n';
                hSys = true;
            } else if( ! hApp ) {
                self._doc += `# API Endpoints [${self._app.apidocs.config[key].name}]\n\n`;
                hApp = true;
            }

            // model loop
            _.each(value, (mValue, mKey) => {
                if( ! mValue.schema.inspector ) return;

                self._doc += `### /api/o/${key}.${mKey}\n`;
                self._doc += '**`headers`** ';
                self._doc += 'X-Access-Token';

                // system modellerinde mutlaka client id ve client secret header'ları bekleniyor
                if(key === 'system') {
                    self._doc += ', X-Client-Id, X-Client-Secret';
                }

                self._doc += '\n\n';

                const save = mValue.schema.inspector.Save.properties;
                const owner = mValue.schema.inspector.Owner;

                // model fields loop
                _.each(save, (fValue) => {
                    // console.log(f_value);
                    self._doc += `>**\`${fValue.alias}\`** `;
                    
                    if(fValue.type === 'array') {
                        self._doc += `[${fValue.ftype}]`;
                    } else {
                        self._doc += fValue.ftype;
                    }

                    if( ! fValue.optional ) {
                        self._doc += ', required';
                    }

                    if(fValue.ref) {
                        self._doc += `, ref: ${fValue.ref.toLowerCase().replace('_', '.')}`;
                    }

                    // console.log(m_key+': '+f_key+', '+f_value);
                    // console.log(f_value);
                    
                    // fild settings
                    if(fValue.settings.options) {
                        self._doc += ', options: {';

                        _.each(fValue.settings.options, (oValue, oKey) => {
                            self._doc += `${oValue.value}: ${oValue.label}`;

                            if(fValue.settings.options[oKey + 1]) {
                                self._doc += ', ';
                            }
                        });
                        self._doc += '}';

                        if(fValue.def) {
                            self._doc += `, default: ${fValue.def}`;
                        }
                    }

                    // set auto generated fields
                    if(key === 'system' && fValue.alias === 'apps') {
                        self._doc += ', auto generated';
                    } else if(owner) {
                        if(owner.alias && fValue.alias === owner.alias) {
                            self._doc += ', auto generated';
                        }

                        if(owner.profile) {
                            if(fValue.alias === owner.profile.alias) {
                                self._doc += ', auto generated';
                            }
                        }
                    }

                    self._doc += '  \n';
                });

                self._doc += '\n\n';
            });
        });
    }

    // push api endpoints
    endpoints(baseurl, collectionId, client) {
        const respArr = [];
        const loginId = uuid.v1();
        
        // api login
        respArr.push({
            collectionId,
            id: loginId,
            headers: `X-Client-Id:${client.id} \nX-Client-Secret:${client.secret} \n`,
            url: `${baseurl}/api/login`,
            method: 'POST',
            data: [
                {key: 'email', value: '', type: 'text', enabled: true},
                {key: 'password', value: '', type: 'text', enabled: true},
            ],
            dataMode: 'urlencoded',
            version: 2,
            name: 'api.login',
            description: '',
        });

        // TODO: other endpoints
        // (bu endpoint'leri de dökümantasyona ekle)
        
        // /api/token get
        // /api/forgot post
        // /api/reset/:token get
        // /api/reset/:token post
        // /api/invite post
        // /api/invite/:token get
        // /api/invite/:token post
        // /api/register post
        // /api/verify/:token get
        // /api/verify/:token post
        // /api/change_password post
        
        return respArr;
    }

    postman() {
        const self = this;
        const obj = {
            version: 1,
            collections: [],
            environments: [],
            headerPresets: [],
            globals: [],
        };
        
        _.each(self._app.apidocs.config, (cValue) => {
            // collections loop (environments)
            _.each(cValue.env, (eValue) => {
                const collId = eValue.apidocs.id || uuid.v1();
                const collObj = {
                    id: collId,
                    name: eValue.apidocs.collection,
                    folders: [],
                    requests: [],
                };
                
                const endpoints = self.endpoints(eValue.apidocs.baseurl, collId, {
                    id: eValue.apidocs.client_id,
                    secret: eValue.apidocs.client_secret,
                });
                
                if(endpoints.length) {
                    _.each(endpoints, endpoint => {
                        collObj.requests.push(endpoint);
                    });
                }
                
                // requests loop
                _.each(self._app.model, (value, key) => {
                    _.each(value, (mValue, mKey) => {
                        if( ! mValue.schema.inspector ) return;

                        // folders
                        const folderId = uuid.v1();
                        const folderObj = {
                            id: folderId,
                            name: `${key}.${mKey}`,
                            description: '',
                            write: true,
                            collection_name: eValue.apidocs.collection,
                            collection_id: collId,
                            collection: collId,
                            order: [],
                            owner: 0,
                            collection_owner: 0,
                        };

                        collObj.folders.push(folderObj);

                        // requests
                        _.each(['GET', 'POST', 'PUT', 'DELETE'], method => {
                            const reqId = uuid.v1();
                            const reqObj = {
                                collectionId: collId,
                                id: reqId,
                                headers: 'X-Access-Token: \n',
                                url: `${eValue.apidocs.baseurl}/api/o/${key}.${mKey}`,
                                method,
                                data: [],
                                dataMode: '',
                                version: 2,
                                name: `${key}.${mKey}`,
                                description: '',
                                folder: folderId,
                                owner: 0,
                            };

                            // push to folder order
                            folderObj.order.push(reqId);

                            if(key === 'system') {
                                reqObj.headers += `X-Client-Id: ${eValue.apidocs.client_id}\nX-Client-Secret: ${eValue.apidocs.client_secret}\n`;
                            }
                            
                            if(method === 'PUT' || method === 'DELETE') {
                                reqObj.url += '/:id';
                            }
                            
                            if(method === 'POST' || method === 'PUT') {
                                reqObj.dataMode = 'urlencoded';
                            } else if(method === 'GET') {
                                reqObj.dataMode = 'params';
                            }
                            
                            // data loop
                            const save = mValue.schema.inspector.Save.properties;
                            const get = [];
                            
                            _.each(save, (fValue) => {
                                const dataObj = {
                                    key: fValue.alias,
                                    value: '',
                                    type: 'text',
                                    enabled: false,
                                };

                                if(method === 'GET') {
                                    get.push(`${fValue.alias}=`);
                                } else {
                                    reqObj.data.push(dataObj);
                                }
                            });

                            if(method === 'GET') {
                                reqObj.url += `?${get.join('&')}`;
                            }
                            
                            collObj.requests.push(reqObj);
                        });
                    });
                });
                
                obj.collections.push(collObj);
            });
        });

        fs.writeFile(`${self._app.get('basedir')}/postman.json`, JSON.stringify(obj, null, 2), () => {
            debug('postman file saved!');
        });
    }

}

module.exports = () => ApiDocs;
