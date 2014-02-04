var chai = require('chai');
var expect = chai.expect;
var keydb = require('keydb');
var Stream = require('stream');

require('mocha-as-promised')();
chai.use(require('chai-as-promised'));
describe('ftp driver test', function () {
  var db = keydb();
  db.driver(keydb.drivers.media);
  db.driver(keydb.drivers.ftp);

  it('should set value on /usr/local/foo.txt', function () {
    var stream = new Stream();

    stream.pipe = function (dest) {
      dest.write('bar');
    };
    var promise = db({op: 'set', key: '/usr/local/foo.txt', value: stream});
    return expect(promise).to.be.fulfilled;
  });
  it('should get value on foo.txt', function () {
    var promise = db({op: 'get-string', key: '/usr/local/foo.txt'});
    promise.then(function (result) {
      console.log(typeof result);
      console.log(result);
    }).fail(function (err) {
      console.log('Failed: ' + err);
    });
    return expect(promise).to.eventually.eql('bar');
  });
  it('should get the meta on foo.txt', function () {
    var promise = db({op: 'meta', key: '/usr/local/foo.txt'});
    promise.then(function (result) {
      console.log(typeof result);
      console.log(result);
      return expect(result.type).to.eql('file');
    }).fail(function (err) {
      console.log('Failed: ' + err);
    });
    
  });
});