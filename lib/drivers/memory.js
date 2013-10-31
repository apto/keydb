var createMemorySource = function (next, obj) {
  var items = obj || {};

  var ops = {
    get: function (msg) {
      return {
        key: msg.key,
        value: items[msg.key]
      };
    },
    set: function (msg) {
      items[msg.key] = msg.value;
    }
  };

  var source = function (msg) {
    return ops[msg.op](msg);
  };

  return source;
};

module.exports = createMemorySource;