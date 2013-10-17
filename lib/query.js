var funql = require('funql');
var util = require('./util');
var _ = require('underscore');

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

proto._query = function (options) {
  var keys = util.filterToKeys(this.filter);
  if (keys && keys.length === 0) {
    return util.defer([]);
  }
  if (keys) {
    options = _.extend({keys: keys}, options);
  }
  if (keys && this.db.driver.query_keys) {
    return this.db.driver.query_keys(keys, options, this.filter);
  } else {
    return this.db.driver.query(this.filter, options);
  }
};

var createQuery = function (db, filter) {
  filter = desugarFilter(filter);
  return new Query(db, filter);
};

module.exports = createQuery;