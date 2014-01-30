var _ = require('underscore');
var utils = require('../utils');

var isMedia = function (value) {
  return utils.isBuffer(value) || utils.isReadStream(value);
};

var createMediaSource = function (next) {

  var ops = {
    _get: function (msg) {
      msg = _.extend({}, msg, {op: 'get'});
      return next(msg);
    },
    'get-media': function (msg) {
      return ops._get(msg);
    },
    'get-string': function (msg) {
      return ops._get(msg)
        .then(function (msg) {
          return utils.stringPromise(msg.value)
            .then(function (value) {
              return _.extend({}, msg, {value: value});
            });
        });
    },
    'get-buffer': function (msg) {
      return ops._get(msg)
        .then(function (msg) {
          return utils.bufferPromise(msg.value)
            .then(function (buffer) {
              return _.extend({}, msg, {value: buffer});
            });
        });
    },
    'get-stream': function (msg) {
      return ops._get(msg)
        .then(function (msg) {
          return _.extend({}, msg, {value: utils.valueStream(msg.value)});
        });
    },
    get: function (msg) {
      return next(msg).then(function (mediaMsg) {
        if (mediaMsg.mediaType === 'application/json') {
          return utils.stringPromise(mediaMsg.value)
            .then(function (value) {
              return _.extend({}, mediaMsg, {value: JSON.parse(value)});
            });
        } else {
          return mediaMsg;
        }
      });
    },
    set: function (msg) {
      if (!msg.mediaType && !msg.type && !isMedia(msg.value)) {
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