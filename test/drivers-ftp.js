var chai = require('chai'),
    expect = chai.expect,
    keydb = require('keydb'),
    Stream = require('stream'),
    fs = require('fs'),
    Server = require('ftp-test-server'),
    _portfinder = require('portfinder'),
    q = require('q'),
    path = require('path');
function deleteFolderRecursive(loc) {
  var files = [];
  if (fs.existsSync(loc)) {
    files = fs.readdirSync(loc);
    files.forEach(function (file, index) {
        var curPath = loc + "/" + file;
        if (fs.statSync(curPath).isDirectory()) { // recurse
          deleteFolderRecursive(curPath);
        } else { // delete file
          fs.unlinkSync(curPath);
        }
      });
    fs.rmdirSync(loc);
  }
}

var portfinder = {
    getPort: q.nbind(_portfinder.getPort, _portfinder)
  };

require('mocha-as-promised')();
chai.use(require('chai-as-promised'));
describe('ftp driver test', function () {
  var db = keydb();
  before(function () {
    // Create the test directories and files
    if (!fs.existsSync(path.join(__dirname, 'fixtures/tmp'))) {
      fs.mkdirSync(path.join(__dirname, 'fixtures/tmp'));
    }
    if (!fs.existsSync(path.join(__dirname, 'fixtures/tmp/cric'))) {
      fs.mkdirSync(path.join(__dirname, 'fixtures/tmp/cric'));
    }
    fs.writeFileSync(path.join(__dirname, 'fixtures/tmp/test.txt'), "bar");
    fs.writeFileSync(path.join(__dirname, 'fixtures/tmp/delete.txt'), "this file will be deleted");
    fs.writeFileSync(path.join(__dirname, 'fixtures/tmp/cric/delete.txt'), "this file will be deleted");
    fs.writeFileSync(path.join(__dirname, 'fixtures/tmp/cric/delete2.txt'), "this file will be deleted");
    
    return portfinder.getPort().then(function (port) {
      var myFtp = new Server();
      myFtp.init({
        user: "test",
        pass: "abc",
        port: port
      });
      db.driver(keydb.drivers.media);
      db.driver(keydb.drivers.ftp, {
        username : 'test',
        password : 'abc',
        port : port
      });
    });
  });
  it('should set value on foo.txt', function (done) {
    var st = fs.createReadStream(path.join(__dirname, 'fixtures/tmp/test.txt'));
    var promise = db({op: 'set', key: 'test/fixtures/tmp/foo.txt', value: st});
    
    return expect(promise).to.be.fulfilled;
  });
  it('should set a directory ', function () {
    var promise = db({op: 'set', key: 'test/fixtures/tmp/xyz', type : "collection"});
    return expect(promise).to.be.fulfilled;
  });
  it('should delete ', function () {
    var promise = db({op: 'delete', key:  'test/fixtures/tmp/delete.txt'});
    return expect(promise).to.be.fulfilled;
  });
  it('should get value on test.txt', function () {
    var promise = db({op: 'get-string', key: 'test/fixtures/tmp/test.txt'}).then(function (result) {
      return result.value;

    });
    return expect(promise).to.eventually.eql("bar");
  });
  it('should get a directory', function () {
    var promise = db({op: 'get', key: '/'}).then(function (result) {
      expect(result.value.length).to.be.above(0);
    });
  });
  it('should get the meta on foo.txt', function () {
    var promise = db({op: 'meta', key: 'test/fixtures/tmp/test.txt'}).then(function (result) {
      return result.type;
    });
    return expect(promise).to.eventually.eql('file');
    
  });
  it('should move a file', function () {
    var promise = db({op: 'move', key: 'test/fixtures/tmp/test.txt', toKey: 'test/fixtures/tmp/test-renamed.txt'});
    return expect(promise).to.be.fulfilled;
    
  });
  it('should move a directory', function () {
    var promise = db({op: 'move', key: 'test/fixtures/tmp/xyz', toKey: 'test/fixtures/tmp/abc'});
    return expect(promise).to.be.fulfilled;
    
  });
  it('should copy a file', function () {
    var promise = db({op: 'copy', key: 'test/fixtures/tmp/test-renamed.txt', toKey : 'test/fixtures/tmp/test.txt'});
    return expect(promise).to.be.fulfilled;
    
  });

  it('should copy a directory', function () {
    var promise = db({op: 'copy', key: 'test/fixtures/tmp/cric', toKey : 'test/fixtures/tmp/sae'});
    return expect(promise).to.be.fulfilled;
    
  });

  after(function () {
    deleteFolderRecursive(path.join(__dirname, 'fixtures/tmp'));
  });
});