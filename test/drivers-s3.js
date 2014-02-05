var chai = require('chai');
var expect = chai.expect;
var keydb = require('keydb');

require('mocha-as-promised')();
chai.use(require('chai-as-promised'));

describe('s3 driver test', function () {

  var db = keydb();
  db.driver(keydb.drivers.media);
  db.driver(keydb.drivers.s3);

  it('should set value on root', function () {
    var promise = db({op: 'set', key: 'foo', value: 'bar'});
    return expect(promise).to.be.fulfilled;
  });

  it('should get value on root', function () {
    var promise = db({op: 'get-string', key: 'foo'});
    return expect(promise).to.eventually.eql({ key: 'foo', value: '"bar"' });
  });

  it('should fail to get nonexistent file \'abc\'', function () {
    var promise = db({op: 'get', key: 'abc'})
    expect(promise).to.be.rejectedWith(keydb.error.NotFound);    
  });

  it('should get meta for file', function () {
    var promise = db({op: 'meta', key: 'foo'})
    return expect(promise).to.eventually.eql({ key: 'foo' });
  });

  it('should fail to get meta for nonexistent file \'abc\'', function () {
    var promise = db({op: 'meta', key: 'abc'})
    expect(promise).to.be.rejectedWith(keydb.error.NotFound);    
  });

  it('should delete value on root', function () {
    return db({op: 'delete', key: 'foo', value: 'bar'});
  });

  it('should fail to get deleted value on root', function () {
    var promise = db({op: 'get-string', key: 'foo'}).then(function (msg) {
      return msg.value;
    });
    expect(promise).to.be.rejectedWith(keydb.error.NotFound);
  });

  it('should create a collection', function () {
    return db({op: 'set', key: 'users', type: 'collection', value: {}});
  });

  it('should set a value on a collection', function () {
    return db({op: 'set', key: 'users/joe', value: {fn: 'Joe'}});
  });

  it('should get a value on a collection', function () {
    var promise = db({op: 'get-string', key: 'users/joe'}).then(function (msg) {
      return JSON.parse(msg.value);
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

  it('should get meta for a collection', function () {
    var promise = db({op: 'meta', key: 'users'});
    return expect(promise).to.eventually.eql({ key: 'users', type: 'collection' });
  });

  it('should create a file from a stream', function () {
    var fs = require('fs');
    var fileStream = fs.createReadStream('./drivers-s3.js');
    var promise = db({op: 'set', key: 'drivers-s3.js', value: fileStream});
    return expect(promise).to.be.fulfilled;
  });

});
