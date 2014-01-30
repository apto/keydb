var _ = require('underscore');

var createMediaSource = function (next) {

  var ops = {
    'get-media': function (msg) {
      msg = _.extend({}, msg, {op: 'get'});
      return next(msg);
    },
    get: function (msg) {
      return next(msg).then(function (mediaMsg) {
        if (mediaMsg.mediaType === 'application/json') {
          return _.extend({}, mediaMsg, {value: JSON.parse(mediaMsg.value)});
        } else {
          return mediaMsg;
        }
      });
    },
    set: function (msg) {
      if (!msg.mediaType && !msg.type) {
        msg = _.extend({}, msg, {value: JSON.stringify(msg.value), mediaType: 'application/json'});
      }
      return next(msg);
    }
  };

  var source = function (msg) {
    if (ops[msg.op]) {
      return ops[msg.op](msg);
    } else {
      return next(msg);
    }
  };

  return source;
};

module.exports = createMediaSource;