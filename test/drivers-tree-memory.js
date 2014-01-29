var chai = require('chai');
var expect = chai.expect;
var keydb = require('keydb');

require('mocha-as-promised')();
chai.use(require('chai-as-promised'));

describe('tree memory driver test', function () {
  var db = keydb('tree-memory');
  it('should set value on root', function () {
    return db({op: 'set', key: 'foo', value: 'bar'});
  });
  it('should get value on root', function () {
    var promise = db({op: 'get', key: 'foo'}).then(function (msg) {
      return msg.value;
    });
    expect(promise).to.eventually.eql('bar');
  });
  it('should create a collection', function () {
    return db({op: 'set', key: 'users', type: 'collection', value: {}});
  });
  it('should set a value on a collection', function () {
    return db({op: 'set', key: 'users/joe', value: {fn: 'Joe'}});
  });
  it('should get a value on a collection', function () {
    var promise = db({op: 'get', key: 'users/joe'}).then(function (msg) {
      return msg.value;
    });
    return expect(promise).to.eventually.eql({fn: 'Joe'});
  });
  it('should get a list of nodes for a collection', function () {
    return db({op: 'get', key: 'users'}).then(function (msg) {
      expect(msg.value.length).to.equal(1);
      expect(msg.value).to.eql([
        {key: 'users/joe'}
      ]);
    });
  });
});