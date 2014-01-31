var chai = require('chai');
var expect = chai.expect;
var keydb = require('keydb');
var utils = keydb.utils;
var fs = require('fs');
var Path = require('path');

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
    return expect(promise).to.eventually.eql('bar');
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
  it('should copy a value on a collection', function () {
    return db({op: 'copy', key: 'users/joe', toKey: 'users/joseph'});
  });
  it('should get copied value', function () {
    return db({op: 'get', key: 'users/joseph'})
      .then(function (msg) {
        expect(msg.value).to.eql({fn: 'Joe'});
      });
  });
  it('should move a value on a collection', function () {
    return db({op: 'move', key: 'users/joseph', toKey: 'users/jack'});
  });
  it('should get moved value', function () {
    return db({op: 'get', key: 'users/jack'})
      .then(function (msg) {
        expect(msg.value).to.eql({fn: 'Joe'});
      });
  });
  it('should not find moved value at original location', function () {
    return expect(db({op: 'get', key: 'users/joseph'})).to.be.rejectedWith(keydb.error.NotFound);
  });
  it('should copy a collection', function () {
    return db({op: 'copy', key: 'users', toKey: 'losers'});
  });
  it('should find value at new collection', function () {
    return db({op: 'get', key: 'losers/jack'})
      .then(function (msg) {
        expect(msg.value).to.eql({fn: 'Joe'});
      });
  });
  it('should delete a value from a collection', function () {
    return db({op: 'delete', key: 'users/joe'});
  });
  it('should not find a deleted value on a collection', function () {
    return expect(db({op: 'get', key: 'users/joe'})).to.be.rejectedWith(keydb.error.NotFound);
  });
  it('should set a media value on a collection', function () {
    return db({op: 'set', key: 'files', type: 'collection', value: {}}).then(function () {
      return db({op: 'set', key: 'files/foo.txt', value: 'Hello, world!', mediaType: 'text/plain'});
    });
  });
  it('should get a media value on a collection', function () {
    // returns whatever driver wants to return
    return db({op: 'get-media', key: 'files/foo.txt'}).then(function (msg) {
      expect(msg.value.toString()).to.eql('Hello, world!');
    });
  });
  it('should get a media value as buffer on a collection', function () {
    return db({op: 'get-buffer', key: 'files/foo.txt'}).then(function (msg) {
      expect(msg.value.toString()).to.eql('Hello, world!');
    });
  });
  it('should get a media value as string on a collection', function () {
    return db({op: 'get-string', key: 'files/foo.txt'}).then(function (msg) {
      expect(msg.value).to.eql('Hello, world!');
    });
  });
  it('should get a media value as stream on a collection', function () {
    return db({op: 'get-stream', key: 'files/foo.txt'}).then(function (msg) {
      return utils.streamToStringPromise(msg.value)
        .then(function (value) {
          expect(value).to.eql('Hello, world!');
        });
    });
  });
  it('should set a media value on a collection using a stream', function () {
    var filePath = Path.join(__dirname, 'fixtures/hello.txt');
    var file = fs.createReadStream(filePath);
    return db({op: 'set', key: 'files/hello.txt', mediaType: 'text/plain', value: file});
  });
  it('should get the file media value as string', function () {
    return db({op: 'get-string', key: 'files/hello.txt'}).then(function (msg) {
      expect(msg.value).to.eql('hello');
    });
  });
  it('should get the meta for a collection', function () {
    return db({op: 'meta', key: 'files'})
      .then(function (msg) {
        expect(msg.key).to.equal('files');
        expect(msg.type).to.equal('collection');
        expect(msg.value).to.equal(undefined);
      });
  });
  it('should get the meta for a file', function () {
    return db({op: 'meta', key: 'files/hello.txt'})
      .then(function (msg) {
        expect(msg.key).to.equal('files/hello.txt');
        expect(msg.type).to.not.equal('collection');
        expect(msg.value).to.equal(undefined);
      });
  });
});