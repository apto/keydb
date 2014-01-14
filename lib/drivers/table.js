var error = require('../error');

var valueToRow = function (msg) {
  var row = {
    media_value: null,
    media_type: null
  };
  if (msg.isBinary) {
    row.value_type = 'bin';
    row.media_type = msg.mediaType;
    // TODO: need to parse base64, blah, blah
  } else if (msg.mediaType) {
    row.value_type = 'txt';
    row.media_type = msg.mediaType;
    row.media_value = msg.value;
  } else if (typeof msg.value === 'string') {
    row.value_type = 'str';
    row.media_value = msg.value;
  } else if (typeof msg.value === 'number') {
    row.value_type = 'num';
    row.media_value = JSON.stringify(msg.value);
  } else if (typeof msg.value === 'boolean') {
    row.value_type = 'bool';
    row.media_value = JSON.stringify(msg.value);
  } else if (typeof msg.value === 'undefined' || msg.value === 'null') {
    row.value_type = 'null';
  } else {
    row.value_type = 'json';
    row.media_value = JSON.stringify(msg.value);
  }
  return row;
};

var rowToObject = function (row) {
  var obj = {value: null};
  if (row.value_type === 'bin') {
    obj.isBinary = true;
    obj.mediaType = row.media_type;
    // TODO: convert to base64, blah, blah
  } else if (row.value_type === 'txt') {
    obj.mediaType = row.media_type;
    obj.value = row.media_value.toString();
  } else if (row.value_type === 'str') {
    obj.value = row.media_value.toString();
  } else if (row.value_type === 'num') {
    obj.value = JSON.parse(row.media_value.toString());
  } else if (row.value_type === 'bool') {
    obj.value = JSON.parse(row.media_value.toString());
  } else if (row.value_type === 'null') {
    obj.value = null;
  } else if (row.value_type === 'json') {
    // cross fingers
    obj.value = JSON.parse(row.media_value.toString());
  } else {
    obj.value = null;
  }
  return obj;
};



var createTableSource = function (next) {

  var ops = {
    set: function (msg, op) {
      var tableMsg = {};
      tableMsg.op = op || 'upsert';
      tableMsg.attributes = valueToRow(msg);
      tableMsg.attributes.item_key = msg.key;
      tableMsg.filters = {
        item_key: msg.key
      };
      tableMsg.table = 'item';
      return next(tableMsg);
    },
    create: function (msg) {
      var tableMsg = {};
      tableMsg.op = 'create';
      tableMsg.attributes = valueToRow(msg);
      tableMsg.attributes.item_key = msg.key;
      tableMsg.table = 'item';
      return next(tableMsg);
    },
    update: function (msg) {
      return ops.set(msg, 'update');
    },
    get: function (msg) {
      var tableMsg = {};
      tableMsg.op = 'query';
      tableMsg.table = 'item';
      tableMsg.filters = {
        item_key: msg.key
      };
      return next(tableMsg)
        .then(function (result) {
          if (result.items.length === 0) {
            throw new error.NotFound({key: msg.key});
          } else {
            var obj = rowToObject(result.items[0]);
            obj.key = msg.key;
            return obj;
          }
        });
    },
    delete: function (msg) {
      return next({
        op: 'delete',
        table: 'item',
        filters: {
          item_key: msg.key
        }
      });
    }
  };

  var source = function (msg) {
    var result;
    if (ops[msg.op]) {
      result = ops[msg.op](msg);
    } else {
      result = next(msg);
    }
    return result;
  };

  return source;
};

module.exports = createTableSource;