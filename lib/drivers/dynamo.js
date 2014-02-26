var aws = require('aws-sdk');
var q = require('q');
var error = require('../error');
var utils = require('../utils');
var _ = require('underscore');

var createDb = function (options) {
  var _db;
  var prefix = '';
  var defaultRegion = aws.config.region;
  if (!defaultRegion || defaultRegion === '') {
    defaultRegion = 'us-east1';
  }
  var region = options.region || process.env.KEYDB_DRIVERS_DYNAMO_REGION || defaultRegion;

  if (options.database) {
    prefix = options.database + '_';
  }

  if (options.local || process.env.KEYDB_DRIVERS_DYNAMO_LOCAL) {
    var port = options.port || process.env.KEYDB_DRIVERS_DYNAMO_PORT || 8000;
    _db = new aws.DynamoDB({
      credentials: new aws.Credentials({accessKeyId: 'dynamodblocal', secretAccessKey: 'xyz'}),
      region: region,
      endpoint: new aws.Endpoint('http://localhost:' + port)
    });
  } else {
    aws.config.region = region;
    _db = new aws.DynamoDB();
  }

  var db = {
    putItem: q.nbind(_db.putItem, _db),
    getItem: q.nbind(_db.getItem, _db),
    listTables: q.nbind(_db.listTables, _db),
    tableExists: function (tableName) {
      return db.listTables()
        .then(function (tables) {
          return tables.TableNames.indexOf(tableName) !== -1;
        });
    },
    createTable: q.nbind(_db.createTable, _db),
    deleteTable: q.nbind(_db.deleteTable, _db),
    deleteItem: q.nbind(_db.deleteItem, _db),
    tableId: function (tableName) {
      return prefix + tableName;
    }
  };

  return db;
};

var attrTypes = {
  string: 'S'
};

var toAttrType = function (type) {
  return attrTypes[type];
};

var toAttr = function (value) {
  var attr = {

  };
  attr[toAttrType(typeof value)] = value;
  return attr;
};

var toAttrDef = function (name, schema) {
  return {
    AttributeName: name,
    AttributeType: toAttrType(schema.type)
  };
};

var toItem = function (value) {
  var item = {};
  Object.keys(value).forEach(function (key) {
    item[key] = toAttr(value[key]);
  });
  return item;
};

var toAttrValue = function (attr) {
  if (attr.S) {
    return attr.S;
  }
};

var toValue = function (item) {
  var value = {};
  Object.keys(item).forEach(function (key) {
    value[key] = toAttrValue(item[key]);
  });
  return value;
};

var createDynamoSource = function (next, options) {

  var db = createDb(options);

  var makeInitTableFn = function (tableName) {
    return function () {
      var table = options.tables[tableName];
      if (!table) {
        throw new error.TableSchemaNotFound({table: tableName});
      }
      var props = table.properties;
      if (!table.primaryKey) {
        throw new error.PrimaryKeyRequired({table: tableName});
      }
      var schema = {
        TableName: tableName,
        KeySchema: [
          {AttributeName: table.primaryKey, KeyType: 'HASH'}
        ],
        ProvisionedThroughput: {
          ReadCapacityUnits: 10,
          WriteCapacityUnits: 10
        },
        AttributeDefinitions: [
          toAttrDef(table.primaryKey, table.properties[table.primaryKey])
        ]
      };
      return db.createTable(schema);
    };
  };

  var readyTable = {};

  var ready = function (msg) {
    if (!msg.table) {
      return q(true);
    }
    if (!readyTable[msg.table]) {
      readyTable[msg.table] = utils.createReady(makeInitTableFn(msg.table));
    }
    return readyTable[msg.table]();
  };

  var ops = {
    create: function (msg) {
      var expected = {};
      var primaryKey = options.tables[msg.table].primaryKey;
      expected[primaryKey] = {
        Exists: false
      };
      return ops.set(msg, expected);
    },
    set: function (msg, expected) {
      var attributes = _.extend({}, msg.attributes || msg.value);
      if (msg.key) {
        var keyAttr = options.tables[msg.table].primaryKey;
        attributes[keyAttr] = msg.key;
      }
      var item = toItem(attributes);
      var req = {
        TableName: msg.table,
        Item: item
      };
      if (expected) {
        req.Expected = expected;
      }
      return db.putItem(req);
    },
    update: function (msg) {
      return ops.set(msg);
    },
    get: function (msg) {
      var key = {};
      var keyAttr = options.tables[msg.table].primaryKey;
      key[keyAttr] = toAttr(msg.key);
      return db.getItem({
        TableName: msg.table,
        Key: key
      }).then(function (res) {
        if (!res.Item) {
          throw new error.NotFound({key: msg.key});
        } else {
          var value = toValue(res.Item);
          if (keyAttr in value) {
            delete value[keyAttr];
          }
          return {
            key: msg.key,
            value: value
          };
        }
      });
    },
    query: function (msg) {
      var primaryKey = options.tables[msg.table].primaryKey;
      var key = {};
      if (msg.filters[primaryKey]) {
        key[primaryKey] = toAttr(msg.filters[primaryKey]);
      }
      var req = {
        TableName: msg.table,
        Key: key,
        AttributesToGet: msg.attributes
      };
      return db.getItem(req).then(function (res) {
        if (!res.Item) {
          return {
            items: []
          };
        } else {
          return {
            items: [
              toValue(res.Item)
            ]
          };
        }
      });
    },
    'delete': function (msg) {
      var req = {
        TableName: msg.table,
        Key: toItem(msg.filters)
      };
      return db.deleteItem(req);
    },
    'delete-database': function (msg) {
      var promise = Object.keys(options.tables).reduce(function (prev, curr) {
        return prev.then(function () {
          return db.tableExists(curr)
            .then(function (exists) {
              if (exists) {
                return db.deleteTable({TableName: curr});
              }
            });
        });
      }, q(true));
      return promise;
    }
  };

  var source = function (msg) {
    return ready(msg)
      .then(function () {
        return ops[msg.op](msg);
      });
  };

  return source;
};

module.exports = createDynamoSource;