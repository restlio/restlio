const chai    = require('chai');
const should  = chai.should();
const assert  = chai.assert;
const Restlio = require('../index');

let restlio;
before(function (done) {
    this.timeout(0);
    
    restlio = new Restlio({
        basedir: __dirname,
        test: true
    }).run(() => {
        done();
    });
});

after(function (done) {
    this.timeout(0);
    done();
});

describe('app',function() {
    this.timeout(0);

    it('should have properties',done => {
        assert.deepProperty(restlio, '_app.config');
        assert.deepProperty(restlio, '_app.system');
        assert.deepProperty(restlio, '_app.lib');
        assert.deepProperty(restlio, '_app.boot');
        assert.deepProperty(restlio, '_app.core');
        assert.deepProperty(restlio, '_app.libpost');
        assert.deepProperty(restlio, '_app.middle');
        assert.deepProperty(restlio, '_app.model');
        done();
    });    

});

/**
 * TODO:
 * tests, tests, tests, more tests...
 */