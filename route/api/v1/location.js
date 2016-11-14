const async = require('async');
const _     = require('underscore');

module.exports = app => {

    const _mdl    = app.middle;
    const _resp   = app.system.response.app;
    const _schema = app.lib.schema;

    app.get('/api/location/search',
        _mdl.client,
        _mdl.json,
    (req, res, next) => {
        const q      = req.query.q;
        const page   = req.query.page || 1;
        const size   = req.query.size || 10;
        let fc     = req.query.feature_codes;
        const schema = new _schema('system.locations').init(req, res, next);

        if(fc)
            fc = fc.split(',');

        const shouldArr = [];
        if(fc && fc.length) {
            _.each(fc, value => {
                shouldArr.push({query: {match: {fc: value}}});
            });
        }

        const query = {
            filtered: {
                filter: {
                    bool: {
                        must_not: [
                            {query: {match: {fc: 'HTL'}}}, // Otel
                            {query: {match: {fc: 'CSNO'}}}, // Kumarhane
                            {query: {match: {fc: 'RSRT'}}}, // Tatil yeri
                            {query: {match: {fc: 'GHSE'}}}, // Konukevi
                            {query: {match: {fc: 'SPA'}}}, // Spa
                            {query: {match: {fc: 'HMSD'}}}, // Kır evi
                            {query: {match: {fc: 'HSE'}}}, // Ev
                            {query: {match: {fc: 'HSEC'}}} // Yazlık ev
                        ]
                    }
                },
                query: {
                    match: {
                        _all: {
                            query: q,
                            operator: 'and'
                        }
                    }
                }
            }
        };

        // set should filter
        if(shouldArr.length)
            query.filtered.filter.bool.should = shouldArr;

        // execute search
        schema.search(query, {
            hydrate: true,
            hydrateOptions: {
                populate: {
                    path: 'parentId',
                    select: 'n an aen atr fc'
                },
                select: 'parentId n an aen uen atr utr uri uc cc fc w',
                lean: true
            },
            from: (page-1)*size,
            size,
            sort: [
                {p: {order: 'desc'}},
                {_score: {order: 'desc'}}
            ]
        }, (err, doc) => {
            _resp.OK({doc}, res);
        });

    });

};