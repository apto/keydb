/* global describe, it */
/* jshint expr: true */

var chai = require('chai');
var expect = chai.expect;
var keydb = require('keydb');
var q = require('q');
var dynamoLocal = require('dynamo-local');
var portfinder = require('portfinder');
var Path = require('path');
var fs = require('fs');

require('mocha-as-promised')();
chai.use(require('chai-as-promised'));

//var options = { port: 8000 };
//dynamoLocal({port: 8000, dbPath: '.'}, function (err) { /* ... */ });

dynamoLocal = q.denodeify(dynamoLocal);
var getPort = q.nbind(portfinder.getPort, portfinder);

var testDatabase = function (type, options) {
  options = options || {};
  describe(type + ' driver test', function () {
    var db = keydb();
    var driverOptions = {
      database: 'test',
      tables: {
        user: {
          properties: {
            user_id: {
              type: 'string',
              maxLength: 100
            },
            first_name: {
              type: 'string',
              maxLength: 100
            },
            last_name: {
              type: 'string',
              maxLength: 100
            }
          },
          primaryKey: 'user_id'
        },
        log: {
          properties: {
            user_id: {
              type: 'string',
              maxLength: 100
            },
            time_stamp: {
              type: 'string',
              maxLength: 100
            },
            action: {
              type: 'string',
              maxLength: 100
            }
          },
          primaryKey: 'user_id',
          rangeKey: 'time_stamp'
        }
      },
      local: true
    };
    before(function () {
      this.timeout(5000);
      return q(true)
        .then(function () {
          if (type === 'dynamo') {
            return getPort()
              .then(function (port) {
                driverOptions.port = port;
                var dbPath = Path.join(__dirname, 'fixtures/tmp');
                if (!fs.existsSync(dbPath)) {
                  fs.mkdir(dbPath);
                }
                return dynamoLocal({port: port, dbPath: dbPath});
              });
          }
        })
        .then(function () {
          db.driver(keydb.drivers[type], driverOptions);
          return db({op: 'delete-database'});
        });
    });
    var joeAttrs = {
      user_id: 'joe',
      first_name: 'Joe',
      last_name: 'Foo'
    };
    it('should create', function () {
      return db({op: 'create', table: 'user', attributes: joeAttrs});
    });
    it('should query created', function () {
      var promise = db({op: 'query', table: 'user',
        attributes: ['user_id', 'first_name', 'last_name'],
        filters: {user_id: 'joe'}})
        .then(function (msg) {
          return msg.items[0];
        });
      return expect(promise).to.eventually.eql(joeAttrs);
    });
    it('should update', function () {
      joeAttrs.last_name = 'Bar';
      return db({op: 'update', table: 'user', attributes: joeAttrs, filters: {
        user_id: 'joe'
      }});
    });
    it('should query updated', function () {
      var promise = db({op: 'query', table: 'user',
        attributes: ['user_id', 'first_name', 'last_name'],
        filters: {user_id: 'joe'}})
        .then(function (msg) {
          return msg.items[0];
        });
      return expect(promise).to.eventually.eql(joeAttrs);
    });
    if (options.get) {
      it('should get updated', function () {
        return db({op: 'get', table: 'user', key: 'joe'})
          .then(function (msg) {
            expect(msg.key).to.equal('joe');
            expect(msg.value).to.eql({first_name: 'Joe', last_name: 'Bar'});
          });
      });
    }
    it('should delete', function () {
      return db({op: 'delete', table: 'user', filters: {user_id: 'joe'}});
    });
    it('should not find deleted', function () {
      var promise = db({op: 'query', table: 'user',
        attributes: ['user_id', 'first_name', 'last_name'],
        filters: {user_id: 'joe'}}).then(function (msg) {
          return msg.items;
        });
      return expect(promise).to.eventually.eql([]);
    });
    if (options.get) {
      it('should not get deleted', function () {
        return expect(db({op: 'get', table: 'user', key: 'joe'})).to.be.rejectedWith(keydb.error.NotFound);
      });
    }
    if (options.set) {
      it('should set value', function () {
        var promise = db({op: 'set', key: 'joe', value: {first_name: 'Joe', last_name: 'Baz'}, table: 'user'})
          .then(function () {
            return db({op: 'get', key: 'joe', table: 'user'});
          })
          .then(function (msg) {
            return msg.value;
          });
        return expect(promise).to.eventually.eql({first_name: 'Joe', last_name: 'Baz'});
      });
    }
    if (options.range) {
      it('should log action for user', function () {
        return db({op: 'set', key: 'joe/2014-01-01T12:00:00Z', table: 'log', value: {action: 'login'}});
      });
      it('should get action for user', function () {
        var promise = db({op: 'get', key: 'joe/2014-01-01T12:00:00Z', table: 'log'})
          .then(function (msg) {
            return msg.value;
          });
        return expect(promise).to.eventually.eql({action: 'login'});
      });
    }
  });
};

testDatabase('mysql');
testDatabase('dynamo', {get: true, set: true, range: true});