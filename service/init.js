module.exports = app => {
    const env = app.get('env');
    const bottle = app.boot.bottle;
    const model = app.service.model;

    bottle.factory('App', () => app);
    bottle.factory('Config', () => app.config[env]);
    bottle.factory('Cache', () => new app.lib.cache(app));
    bottle.factory('Helper', () => app.lib.utils.helper);

    // worker'da response bulunmuyor
    if(app.system && app.system.response) {
        bottle.factory('Response', () => app.system.response.app);
    }

    // Model Services
    bottle.service('OauthClients', model.oauth.clients, 'App');
    bottle.service('SystemApps', model.system.apps, 'App');
    bottle.service('SystemUsers', model.system.users, 'App');
};
