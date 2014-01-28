var aws = require('aws-sdk');
var q = require('q');

var createDb = function (options) {
  var db = new aws.DynamoDB({
    credentials: new aws.Credentials({accessKeyId: 'dynamodblocal', secretAccessKey: 'xyz'}),
    region: 'us-east1',
    endpoint: new aws.Endpoint('http://localhost:8000')
  });

  return {
    putItem: q.nbind(db.putItem, db),
    getItem: q.nbind(db.getItem, db)
  };
};

var toAttr = function (prop) {
  if (typeof prop === 'string') {
    return {'S': prop};
  }
};

var toItem = function (value) {
  var item = {};
  Object.keys(value).forEach(function (key) {
    item[key] = toAttr(value[key]);
  });
};

var createDynamoSource = function (next, options) {

  var db = createDb(options);

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