var chai = require('chai'),
    expect = chai.expect,
    keydb = require('keydb'),
    Stream = require('stream'),
    fs = require('fs'),
    Server = require('ftp-test-server'),
    portfinder = require('portfinder');



require('mocha-as-promised')();
chai.use(require('chai-as-promised'));
describe('ftp driver test', function () {
  var db = keydb();
  
  portfinder.getPort(function (err, port) {
  

    var myFtp = new Server();

    myFtp.on('stdout', function (data) {
      console.log(data);
    });

    myFtp.on('stderr', function (data) {
      console.log('ERROR', data);
    });
    console.log(port);
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
  before(function () {
    fs.writeFile("test.txt", "bar");
    fs.writeFile("delete.txt", "this file will be deleted");
  });
  it('should set value on foo.txt', function () {
    var st = fs.createReadStream('test.txt');
    var promise = db({op: 'set', key: '/foo.txt', value: st});
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

  after(function () {
    fs.unlinkSync("test.txt");
    fs.unlinkSync("foo.txt");
    fs.rmdirSync("xyz");
  });
});