var chai = require('chai');
var expect = chai.expect;
var keydb = require('keydb');
var Stream = require('stream');
var fs = require('fs');

require('mocha-as-promised')();
chai.use(require('chai-as-promised'));
describe('ftp driver test', function () {
  var db = keydb();
  db.driver(keydb.drivers.media);
  db.driver(keydb.drivers.ftp, {
    username : 'samals',
    password : 'bapuna@44'
  });
  before(function () {
    fs.writeFile("/tmp/test.txt", "bar");
    fs.writeFile("/tmp/delete.txt", "this file will be deleted");
  });
  it('should set value on foo.txt', function () {
    var st = fs.createReadStream('/tmp/test.txt');
    var promise = db({op: 'set', key: '/tmp/foo.txt', value: st});
    return expect(promise).to.be.fulfilled;
  });
  it('should set a directory ', function () {
    var promise = db({op: 'set', key: '/tmp/test', type : "collection"});
    return expect(promise).to.be.fulfilled;
  });
  it('should delete ', function () {
    var promise = db({op: 'delete', key: '/tmp/delete.txt', type : "collection"});
    return expect(promise).to.be.fulfilled;
  });
  it('should get value on test.txt', function () {
    var promise = db({op: 'get-string', key: '/tmp/test.txt'}).then(function (result) {
      return result.value;

    });
    return expect(promise).to.eventually.eql("bar");
  });
  it('should get a directory', function () {
    var promise = db({op: 'get', key: '/tmp'}).then(function (result) {
      expect(result.value.length).to.be.above(0);
    });
  });
  it('should get the meta on foo.txt', function () {
    var promise = db({op: 'meta', key: '/tmp/test.txt'}).then(function (result) {
      return result.type;
    });
    return expect(promise).to.eventually.eql('file');
    
  });

  after(function () {
    fs.unlinkSync("/tmp/test.txt");
    fs.rmdirSync("/tmp/test");
  });
});