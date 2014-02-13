/* global describe, it */
/* jshint expr: true */

var chai = require('chai');
var expect = chai.expect;
var keydb = require('keydb');

require('mocha-as-promised')();
chai.use(require('chai-as-promised'));

var testDatabase = function (type) {
  describe(type + ' driver test', function () {
    var db = keydb();
    db.driver(keydb.drivers[type], {
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
        }
      }
    });
    before(function () {
      return db({op: 'delete-database'});
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
  });
};

testDatabase('mysql');
testDatabase('dynamo');