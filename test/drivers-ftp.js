var chai = require('chai'),
    expect = chai.expect,
    keydb = require('keydb'),
    Stream = require('stream'),
    fs = require('fs'),
    Server = require('ftp-test-server'),
    _portfinder = require('portfinder'),
    q = require('q');

q.longStackSupport = true;
function deleteFolderRecursive(path) {
  var files = [];
  if (fs.existsSync(path)) {
    files = fs.readdirSync(path);
    files.forEach(function (file, index) {
        var curPath = path + "/" + file;
        if (fs.statSync(curPath).isDirectory()) { // recurse
          deleteFolderRecursive(curPath);
        } else { // delete file
          fs.unlinkSync(curPath);
        }
      });
    fs.rmdirSync(path);
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
    fs.writeFileSync("test.txt", "bar");
    fs.writeFileSync("delete.txt", "this file will be deleted");
    fs.mkdirSync("cric");
    fs.writeFileSync("cric/delete.txt", "this file will be deleted");
    fs.writeFileSync("cric/delete2.txt", "this file will be deleted");
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
    var st = fs.createReadStream('test.txt');
    var promise = db({op: 'set', key: 'foo.txt', value: st});
    
    return expect(promise).to.be.fulfilled;
  });
  it('should set a directory ', function () {
    var promise = db({op: 'set', key: 'xyz', type : "collection"});
    return expect(promise).to.be.fulfilled;
  });
  it('should delete ', function () {
    var promise = db({op: 'delete', key: 'delete.txt', type : "collection"});
    return expect(promise).to.be.fulfilled;
  });
  it('should get value on test.txt', function () {
    var promise = db({op: 'get-string', key: 'test.txt'}).then(function (result) {
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
    var promise = db({op: 'meta', key: 'test.txt'}).then(function (result) {
      return result.type;
    });
    return expect(promise).to.eventually.eql('file');
    
  });
  it('should move a file', function () {
    var promise = db({op: 'move', key: 'test.txt', toKey: 'test-renamed.txt'});
    return expect(promise).to.be.fulfilled;
    
  });
  it('should move a directory', function () {
    var promise = db({op: 'move', key: 'xyz', toKey: 'abc'});
    return expect(promise).to.be.fulfilled;
    
  });
  it('should copy a file', function () {
    var promise = db({op: 'copy', key: 'test-renamed.txt', toKey : 'test.txt'});
    return expect(promise).to.be.fulfilled;
    
  });

  it('should copy a directory', function () {
    var promise = db({op: 'copy', key: 'cric', toKey : 'sae'});
    return expect(promise).to.be.fulfilled;
    
  });

  after(function () {
    fs.unlinkSync("test.txt");
    fs.unlinkSync("test-renamed.txt");
    fs.unlinkSync("foo.txt");
    fs.rmdirSync("abc");
    deleteFolderRecursive("cric");
    deleteFolderRecursive("sae");
  });
});