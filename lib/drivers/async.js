var q = require('q');
var utils = require('../utils');

var createAsyncSource = function (next) {
  var items = {};

  var source = function (msg) {
    return q.fcall(function () {
      return next(msg);
    });
  };

  return source;
};

module.exports = createAsyncSource;