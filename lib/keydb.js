var q = require('q');
var utils = require('./utils');

var createStackSource = require('./drivers/stack');

var keydb = function (source) {
  if (typeof source === 'string') {
    var sourceName = source;
    var args = Array.prototype.slice.call(arguments, 1);
    source = keydb.drivers[sourceName].apply([utils.defaultSource].concat(args));
    return source;


    // var stack = createStackSource();
    
    // stack.driver.apply(stack, [keydb.drivers[source]].concat(args));
    // if (keydb.sugars[source]) {
    //   stack = keydb.sugars[source](stack);
    // }
    // return stack;
  } else {
    return createStackSource(source);
  }
};

var camelize = function (id) {
  if (id.indexOf('-') >= 0) {
    var parts = id.split('-');
    if (parts.length > 1) {
      return parts[0] + parts.slice(1).map(function (part) {
        if (part.length > 0) {
          return part[0].toUpperCase() + part.slice(1);
        } else {
          return part;
        }
      }).join('');
    }
  }
  return id;
};

keydb.drivers = {};

keydb.driver = function (id, driver) {
  keydb.drivers[id] = driver;
  keydb.drivers[camelize(id)] = driver;
};

// keydb.sugars = {};

// keydb.sugar = function (id, wrap) {
//   keydb.sugars[id] = wrap;
//   keydb.sugars[camelize(id)] = wrap;
// };

keydb.error = require('./error');

module.exports = keydb;

// var KeyDb = function (source) {
//   this.source = source;
// };

// var proto = KeyDb.prototype;

// proto.send = function (message) {
//   return this.source(message);
// };

// var keydb = function (source) {
//   return new KeyDb(source);
// };

// keydb.drivers = {};

// keydb.driver = function (id, driver) {
//   keydb.drivers[id] = driver;
// };

// module.exports = keydb;

// var q = require('q');

// var KeyDb = function () {
//   this.drivers = {};
//   this.sources = {};
//   this.sourceIsSetup = {};
//   this.sourceSetup = {};
// };

// var proto = KeyDb.prototype;

// proto.driver = function (type, createSource) {
//   this.drivers[type] = createSource;
// };

// proto.source = function (id, driverType, options) {
//   options = options || {};
//   var source = this.drivers[driverType](options);
//   this.sources[id] = source;
//   this.sourceIsSetup[id] = false;
//   if (!source.setup) {
//     this.sourceIsSetup[id] = true;
//   } else {
//     var promise = source.setup(options);
//     this.sourceSetup[id] = promise;
//     promise
//       .then(function () {
//         this.sourceIsSetup[id] = true;
//       })
//       .fail(function () {
//         // try again
//         this.sourceSetup[id] = source.setup(options);
//       });
//   }
// };

// var createDbFn = function () {
//   var db = new KeyDb();
//   var fn = function () {
//     return createDbFn();
//   };
//   Object.keys(proto).forEach(function (key) {
//     fn[key] = proto[key].bind(db);
//   });
//   return fn;
// };

// var defaultDb = createDbFn();

// module.exports = defaultDb;