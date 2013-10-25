var q = require('q');
var _ = require('underscore');
var createQuery = require('./query');
var error = require('./error');
var uuid64 = require('uuid64');
var funql = require('funql');

var driverRegistry = {};
var sourceRegistry = {};

var Api = function (driverType, id, driverConfig) {
  this.driverType = driverType;
  this.id = id;
  driverConfig = driverConfig || {};
  this.driverConfig = _.extend({}, driverConfig);
  this.driverConfig.id = id;
  this.driver = null;
  this.clientId = uuid64();
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

proto.get = function (key, options) {
  var filter = funql.build('eq(key,$key)', {$key: key});
  return createQuery(this, filter).promise(options)
    .then(function (items) {
      if (items.length > 0) {
        return items[0];
      } else {
        throw new error.NotFound({key: key});
      }
    });
};

var validSetOps = ['set', 'create', 'update', 'upsert'];

var validateCommand = function (command) {
  if (validSetOps.indexOf(command.op) >= 0) {
    if (!command.key) {
      throw new error.InvalidKey({key: ''});
    }
  }
};

var commands = {
  send_set: function (command) {
    if (command.ifVersion === null || command.ifVersion === '') {
      return this.send(command, 'create');
    } else if (command.ifVersion) {
      return this.send(command, 'update');
    } else {
      return this.send(command, 'upsert');
    }
  },
  send_upsert: function (command) {
    var self = this;
    // try an update first
    return self.send(command, 'update')
      .fail(function (error1) {
        // maybe that failed because it doesn't exist, so try a create
        return self.send(command, 'create')
          .fail(function (error2) {
            // maybe someone else already created, so try another update
            return self.send(command, 'update')
              .fail(function (error3) {
                throw new error.UpsertFailure({key: command.key, errors: [error1, error2, error3]});
              });
          });
      });
  }
};

proto.normalizeCommand = function (command, op) {
  op = op || command.op;
  if (command.op !== op || !command.version) {
    var newCommand = _.extend({}, command);
    newCommand.op = op;
    newCommand.version = uuid64();
    newCommand.client = this.clientId;
    return newCommand;
  }
  return command;
};

proto._buildViews = function (command) {
  if (command.op !== 'set') {
    return [];
  }
  if (!this.driverConfig.views) {
    return [];
  }
  return this.driverConfig.views.map(function (viewFn) {
    var views = viewFn(command);
    if (typeof views === 'object') {
      if (!Array.isArray(views)) {
        views = [views];
      }
    } else {
      views = [];
    }
    return views;
  }).reduce(function (prev, curr) {
    return prev.concat(curr);
  }, []);
};

proto.send = function (command, op, value, options) {
  var self = this;
  if (typeof command === 'string') {
    command = {
      op: command
    };
    if (typeof op !== 'undefined') {
      command.key = op;
      op = command.op;
    }
    if (typeof value !== 'undefined') {
      command.value = value;
    }
    if (typeof options === 'object') {
      _.extend(command, options);
    }
  }
  op = op || command.op;
  try {
    validateCommand(command);
  } catch (err) {
    return q.reject(err);
  }
  var sendMethod = 'send_' + op;
  return self._driverReady()
    .then(function () {
      if (self.driver.send) {
        return self.driver.send(self.normalizeCommand(command), self._buildViews(command));
      } else if (self.driver[sendMethod]) {
        return self.driver[sendMethod](self.normalizeCommand(command), self._buildViews(command));
      } else if (commands[sendMethod]) {
        return commands[sendMethod].call(self, command);
      } else {
        return q.reject(new error.CommandNotFound(self.normalizeCommand(command)));
      }
    });
};

proto.set = function (key, value, options) {
  options = options || {};
  var command = _.extend({}, options);
  command.op = 'set';
  command.key = key;
  command.value = value;
  return this.send(command);
};

proto.end = function () {
  return this.driver.end();
};

proto.newVersion = function () {
  return uuid64();
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

api.driverTypes = function () {
  return Object.keys(driverRegistry);
};

api.error = require('./error');

module.exports = api;