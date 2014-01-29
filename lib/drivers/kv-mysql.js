var keydb = require('../keydb');
var kvSugar = require('../sugar/kv');
var _ = require('underscore');

module.exports = function (next, options) {

  options = options || {};
  options = _.extend({}, options);
  options.tables = options.tables || {};

  var db = keydb();
  db.driver(keydb.drivers.upsert);
  db.driver(keydb.drivers.version);
  db.driver(keydb.drivers.table, {
    tables: options.tables
  });
  db.driver(keydb.drivers.mysql, {
    database: options.database || 'keydb',
    tables: _.extend({
      item: {
        properties: {
          item_key: {
            type: 'string',
            maxLength: 500
          },
          value_type: {
            type: 'string',
            maxLength: 10
          },
          media_value: {
            type: 'string'
          },
          media_type: {
            type: 'string',
            maxLength: 250
          },
          version: {
            type: 'string',
            maxLength: 50,
            default: "1"
          }
        },
        primaryKey: 'item_key',
        createdTime: 'created_time',
        modifiedTime: 'modified_time',
        required: ['version']
      }
    }, options.tables)
  });

  var source = function (msg) {
    return db(msg);
  };

  return kvSugar(source);
};