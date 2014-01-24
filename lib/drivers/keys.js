var q = require('q');

var createKeysSource = function (next, options) {
  options = options || {};
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
      var items = msgList.map(function (msg) {
        return next(msg);
      });
      if (options.sync) {
        return {items: items};
      } else {
        return q.all(items)
          .then(function (items) {
            return {items: items};
          });
      }
    } else {
      return next(msg);
    }
  };

  return source;
};

module.exports = createKeysSource;