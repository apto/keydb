var utils = require('../utils');
var error = require('../error');

var createStack = function (next) {
  var defaultSource = null;
  var drivers = [];
  var source = next || null;

  var stack = function () {
    if (!source) {
      source = defaultSource;

      source = drivers.reverse().reduce(function (prev, curr) {
        var next = function () {
          return prev.apply(null, arguments);
        };
        var driverSource = curr(next);
        return driverSource;
      }, defaultSource);
    }
    return source.apply(null, arguments);
  };

  stack.driver = function (driver) {
    if (typeof driver !== 'function') {
      throw new error.InvalidDriver({});
    }
    var args = utils.slice(arguments, 1);
    drivers.push(function (next) {
      return driver.apply(null, [next].concat(args));
    });
    return stack;
  };

  stack.source = function (source) {
    defaultSource = source;
    return stack;
  };

  return stack;
};

module.exports = createStack;