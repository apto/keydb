var utils = require('../utils');
var error = require('../error');
var q = require('q');

var createStack = function (defaultSource, options) {
  options = options || {};
  defaultSource = defaultSource || utils.defaultSource;
  var drivers = [];
  var compiledSource = null;
  var sugar = [];

  var wrap = function (fn) {
    if (options.sync) {
      return fn;
    } else {
      return function () {
        return q.fapply(fn, arguments);
      };
    }
  };

  var stack = function () {
    if (!compiledSource) {
      compiledSource = drivers.reverse().reduce(function (prev, curr) {
        // var next;
        // console.log(options)
        // if (options.sync) {
          // next = function () {
          //   return prev.apply(null, arguments);
          // };
        // } else {
        //   next = function () {
        //     return q.fcall(function () {
        //       return prev.apply(null, arguments);
        //     });
        //   };
        // }
        // var driverSource = curr(next);
        // return driverSource;
        //console.log(prev.toString())

        return curr(wrap(prev));

        //return curr(prev);

      }, wrap(defaultSource));
      if (!options.sync) {
        compiledSource = wrap(compiledSource);
      }
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