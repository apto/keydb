/* global describe, it */
/* jshint expr: true */

var expect = require('chai').expect;
var keydb;
try {
  keydb = require('../');
} catch (err) {
  keydb = require('keydb');
}

var doPromise = function (promise) {
  return function (done) {
    if (typeof promise === 'function') {
      promise = promise();
    }
    promise.then(function () {
      done();
    }, done);
  };
};

var testDriver = function (type) {
  describe('driver:' + type, function () {
    var db = keydb(type, 'test');
    before(doPromise(function () {
      return db.send('DELETE_ALL_DATA_FOREVER');
    }));
    describe('send/query', function () {
      var joeValueA = {firstName: 'Joe'};
      var joeValueB = {firstName: 'Joe', lastName: 'Foo'};
      var maryValue = {firstName: 'Mary'};
      it('should create a new item', doPromise(function () {
        var version = db.newVersion();
        return db.set('users/joe', joeValueA, {version: version, ifVersion: null})
          .then(function () {
            return db.get('users/joe');
          })
          .then(function (item) {
            expect(item.value).to.deep.equal(joeValueA);
            expect(item.version).to.equal(version);
          });
      }));
    });
  });
};

keydb.driverTypes().forEach(function (type) {
  testDriver(type);
});