/* global describe, it */
/* jshint expr: true */

var chai = require('chai');
var expect = chai.expect;
var keydb;
try {
  keydb = require('../');
} catch (err) {
  keydb = require('keydb');
}

require('mocha-as-promised')();
chai.use(require('chai-as-promised'));

// var doPromise = function (promise) {
//   return function (done) {
//     if (typeof promise === 'function') {
//       promise = promise(done);
//     }
//     promise.then(function () {
//       done();
//     }, done);
//   };
// };

describe('mysql test', function () {
  var db = keydb();
  db.driver(keydb.drivers.upsert);
  db.driver(keydb.drivers.version);
  db.driver(keydb.drivers.mysql);
  var joeValueA = {firstName: 'Joe'};
  it('should set', function () {
    return db({op: 'set', key: 'users/joe', value: joeValueA});
  });
  it('should get', function () {
    return db({op: 'get', key: 'users/joe'})
      .then(function (msg) {
        expect(msg.value).to.eql(joeValueA);
      });
  });
  it('should not get missing', function () {
    return expect(db({op: 'get', key: 'users/mary'})).to.be.rejectedWith(keydb.error.NotFound);
  });
  it('should delete', function () {
    return db({op: 'delete', key: 'users/joe'})
      .then(function () {
        return expect(db({op: 'get', key: 'users/joe'})).to.be.rejectedWith(keydb.error.NotFound);
      });
  });
  it('should not delete missing', function () {
    return expect(db({op: 'delete', key: 'users/mary'})).to.be.rejectedWith(keydb.error.NotFound);
  });
});

// var testDriver = function (type) {
//   describe('driver:' + type, function () {
//     // var db = keydb(type, 'test');
//     // before(doPromise(function () {
//     //   return db.send('DELETE_ALL_DATA_FOREVER');
//     // }));
//     // describe('send/query', function () {
//     //   var joeValueA = {firstName: 'Joe'};
//     //   var joeValueB = {firstName: 'Joe', lastName: 'Foo'};
//     //   var maryValue = {firstName: 'Mary'};
//     //   it('should create a new item', doPromise(function () {
//     //     var version = db.newVersion();
//     //     return db.set('users/joe', joeValueA, {version: version, ifVersion: null})
//     //       .then(function () {
//     //         return db.get('users/joe');
//     //       })
//     //       .then(function (item) {
//     //         expect(item.value).to.deep.equal(joeValueA);
//     //         expect(item.version).to.equal(version);
//     //       });
//     //   }));
//     //   it('should fail to create a duplicate item', function (done) {
//     //     db.set('users/joe', joeValueA, {ifVersion: null})
//     //     .then(function () {
//     //       done(new Error('db allowed creating a duplicate item'));
//     //     }, function (err) {
//     //       expect(err.code).to.equal('create_conflict');
//     //       done();
//     //     });
//     //   });
//     // });
//   });
// };

// keydb.driverTypes().forEach(function (type) {
//   testDriver(type);
// });