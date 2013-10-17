var q = require('q');
var _ = require('underscore');
var createQuery = require('./query');

var driverRegistry = {};
var sourceRegistry = {};

var Api = function (driverType, id, driverConfig) {
  this.driverType = driverType;
  this.id = id;
  driverConfig = driverConfig || {};
  this.driverConfig = _.extend({}, driverConfig);
  this.driverConfig.id = id;
  this.driver = null;
};

var proto = Api.prototype;

proto._driverReady = function () {
  var self = this;
  if (this._isDriverReady()) {
    return q.when(true);
  }
  return q.when(driverRegistry[this.driverType](this.driverConfig))
    .then(function (driver) {
      self.driver = driver;
      return true;
    });
};

proto._isDriverReady = function () {
  return this.driver !== null;
};

proto.query = function (filter) {
  return createQuery(this, filter);
};

proto.end = function () {
  return this.driver.end();
};

var api = function (driverType, id, driverConfig) {
  if (typeof sourceRegistry[driverType + ':' + id] === 'undefined') {
    driverConfig = driverConfig || {};
    sourceRegistry[driverType + ':' + id] = new Api(driverType, id, driverConfig);
  }
  return sourceRegistry[driverType + ':' + id];
};

api.driver = function (driverType, module) {
  if (typeof module === 'undefined') {
    return driverRegistry[driverType];
  } else {
    driverRegistry[driverType] = module;
  }
};

api.error = require('./error');

module.exports = api;