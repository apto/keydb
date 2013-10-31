var q = require('q');
var utils = require('../utils');

var createAsyncSource = function (next) {
  var items = {};

  var source = function (msg) {
    if (utils.isPromise(msg)) {
      return msg;
    }
    return q.when(next(msg));
  };

  return source;
};

module.exports = createAsyncSource;