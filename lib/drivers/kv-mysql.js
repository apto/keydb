var keydb = require('../keydb');
var kvSugar = require('../sugar/kv');

module.exports = function (next, options) {

  options = options || {};

  var db = keydb();
  db.driver(keydb.drivers.upsert);
  db.driver(keydb.drivers.version);
  db.driver(keydb.drivers.table);
  db.driver(keydb.drivers.mysql, {
    database: options.database || 'keydb',
    tables: {
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
          }
        },
        primaryKey: 'item_key'
      }
    }
  });

  var source = function (msg) {
    return db(msg);
  };

  return kvSugar(source);
};