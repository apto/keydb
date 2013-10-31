// sync keys wrapper around source with only sync get/set

var createKeysSource = function (next) {
  var source = function (msg) {
    if (msg.op === 'get' && msg.keys) {
      var keys = msg.keys || [];
      var prefix = msg.key || '';
      var msgList = keys.map(function (key) {
        return {
          op: 'get',
          key: prefix + key
        };
      });
      return {
        items: msgList.map(function (msg) {
          return next(msg);
        })
      };
    } else {
      return next(msg);
    }
  };

  return source;
};

module.exports = createKeysSource;