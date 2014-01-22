var utils = require('../utils');
var error = require('../error');

var createStack = function (defaultSource) {
  defaultSource = defaultSource || utils.defaultSource;
  var drivers = [];
  var compiledSource = null;
  var sugar = [];

  var stack = function () {
    if (!compiledSource) {
      compiledSource = defaultSource;

      compiledSource = drivers.reverse().reduce(function (prev, curr) {
        var next = function () {
          return prev.apply(null, arguments);
        };
        var driverSource = curr(next);
        return driverSource;
      }, defaultSource);
    }
    return compiledSource.apply(null, arguments);
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
    sugar.forEach(function (key) {
      delete stack[key];
    });
    Object.keys(source).forEach(function (key) {
      if (!(key in stack)) {
        sugar.push(key);
      }
    });
    sugar.forEach(function (key) {
      stack[key] = source[key];
    });
    return stack;
  };

  stack.source(defaultSource);

  return stack;
};

module.exports = createStack;