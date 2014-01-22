module.exports = function (source) {
  var sugar = function (msg) {
    return source(msg);
  };

  sugar.get = function (key) {
    return source({
      op: 'get',
      key: key
    }).then(function (msg) {
      return msg.value;
    });
  };

  sugar.set = function (key, value) {
    return source({
      op: 'set',
      key: key,
      value: value
    });
  };

  sugar.delete = function (key) {
    return source({
      op: 'delete',
      key: key
    });
  };

  return sugar;
};