var chai = require('chai');
var expect = chai.expect;
var keydb = require('keydb');

require('mocha-as-promised')();
chai.use(require('chai-as-promised'));

describe('s3 driver test', function () {

  var db = keydb();
  db.driver(keydb.drivers.media);

  // just for initial testing the below temporarily includes hard coded credentials: 
  // (these need to be removed at some point)
  db.driver(keydb.drivers.s3, 
    { 
      "accessKeyId": "AKIAJCHBC5JUFSW7P7KA", 
      "secretAccessKey": "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", 
      "region": "us-east-1" 
    }
  );

/*
  it('should set value on root', function () {
    var promise = db({op: 'set', key: 'foo', value: 'bar'});
    return expect(promise).to.be.fulfilled;
  });
*/  
  it('should get value on root', function () {
    var promise = db({op: 'get-string', key: 'foo'});
    promise.then(function (result) {
      console.log(typeof result);
      console.log(result);
    }).fail(function (err) {
      console.log('Failed: ' + err);
    })
    return expect(promise).to.eventually.eql('bar');
  });
/*
  it('should delete value on root', function () {
    return db({op: 'delete', key: 'foo', value: 'bar'});
  });
*/
/*
  it('should fail to get deleted value on root', function () {
    var promise = db({op: 'get-string', key: 'foo'}).then(function (msg) {
      return msg.value;
    });
    expect(promise).to.be.rejectedWith(keydb.error.NotFound);
  });
*/
/*
  it('should set collection on root', function () {
    var promise = db({op: 'set', type: 'collection', key: 'fooFolder'});
    return expect(promise).to.be.fulfilled;
  });
*/
  /*
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
*/
});