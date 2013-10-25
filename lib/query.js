var funql = require('funql');
var util = require('./util');
var _ = require('underscore');
var q = require('q');
var error = require('./error');

var buildQuery = function (filter, vars) {
  return funql.compilers.replace(filter, vars);
};

var desugarFilter = function (filter) {
  if (Array.isArray(filter)) {
    return buildQuery('in(key,$keys)', {$keys: filter});
  } else {
    return filter;
  }
};

var Query = function (db, filter) {
  this.db = db;
  this.filter = filter;
};

var proto = Query.prototype;

proto.promise = function (options) {
  options = options || {};
  var self = this;
  return self.db._driverReady()
    .then(function () {
      var result = self._query(options);
      if (result.then) {
        return result;
      }
      return util.streamToPromise(result);
    });
};

proto.then = function () {
  var promise = this.promise();
  return promise.then.apply(promise, arguments);
};

proto._query = function (options) {
  var self = this;
  var keys = util.filterToKeys(this.filter);
  if (keys && keys.length === 0) {
    return util.defer([]);
  }
  if (keys) {
    options = _.extend({keys: keys}, options);
  }
  if (keys && keys.length === 1 && this.db.driver.query_key) {
    return this.db.driver.query_key(keys[0], options, this.filter);
  } else if (keys && this.db.driver.query_keys) {
    return this.db.driver.query_keys(keys, options, this.filter);
  } else if (this.db.driver.query) {
    return this.db.driver.query(this.filter, options);
  } else if (keys && this.db.driver.query_key) {
    // TODO: return stream rather than buffering all this into a promise
    return keys.reduce(function (promise, key) {
      return promise.then(function (items) {
        return createQuery(self.db, [key]).promise().then(function (moreItems) {
          return items.concat(moreItems);
        });
      });
    }, util.fulfilled([]));
  } else {
    return q.rejected(new error.QueryNotSupported({filter: this.filter}));
  }
};

var createQuery = function (db, filter) {
  filter = desugarFilter(filter);
  return new Query(db, filter);
};

module.exports = createQuery;