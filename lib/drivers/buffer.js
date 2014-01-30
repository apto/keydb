var utils = require('../utils');
var _ = require('underscore');

var createBufferSource = function (next) {

  var source = function (msg) {
    if (msg.value) {
      return utils.bufferPromise(msg.value)
        .then(function (buffer) {
          msg = _.extend({}, msg, {value: buffer});
          return next(msg);
        });
    } else {
      return next(msg);
    }
  };

  return source;
};

module.exports = createBufferSource;