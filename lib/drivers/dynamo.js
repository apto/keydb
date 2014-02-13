var aws = require('aws-sdk');
var q = require('q');
var error = require('../error');
var utils = require('../utils');

var createDb = function (options) {
  var _db = new aws.DynamoDB({
    credentials: new aws.Credentials({accessKeyId: 'dynamodblocal', secretAccessKey: 'xyz'}),
    region: 'us-east1',
    endpoint: new aws.Endpoint('http://localhost:8000')
  });

  var db = {
    putItem: q.nbind(_db.putItem, db),
    getItem: q.nbind(_db.getItem, db),
    listTables: q.nbind(_db.listTables, db),
    tableExists: function (tableName) {
      return db.listTables(tableName)
        .then(function (tables) {
          return tables.TableNames.indexOf(tableName) !== -1;
        });
    },
    createTable: q.nbind(_db.createTable, db)
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
    set: function (msg) {
      return db.putItem({
        TableName: msg.table,
        Item: toItem(msg.value)
      });
    },
    get: function (msg) {
      var key = {};
      var keyAttr = options.tables[msg.table].primaryKey;
      key[keyAttr] = toAttr(msg.key);
      return db.getItem({
        TableName: msg.table,
        Key: key
      });
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