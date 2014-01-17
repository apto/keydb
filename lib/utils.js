var uuid64 = require('uuid64');
var funql = require('funql');
var error = require('./error');
var q = require('q');
var stream = require('./stream');
var Readable = stream.Readable;

var dbUtil = exports;

exports.isValidKey = function (key) {
  if (!key || key === '') {
    return false;
  }
  return true;
};

exports.validateKey = function (key) {
  if (!dbUtil.isValidKey(key)) {
    throw new error.InvalidKeyError({key: ''});
  }
};

var filterToKeysCompile = funql.compiler({
  wrap_root: function (node, compile) {
    var keys = compile(node);
    if (Array.isArray(keys)) {
      return keys;
    } else {
      return [keys];
    }
  },
  call_or: function (node, compile) {
    var keys = compile(node.nodes[1].nodes, {parent: 'or'});
    var concatKeys = [];
    keys.forEach(function (key) {
      if (Array.isArray(key)) {
        concatKeys = concatKeys.concat(key);
      } else {
        concatKeys.push(key);
      }
    });
    return concatKeys;
  },
  call_eq: function (node, copile) {
    var propertyNode = node.nodes[1].nodes[0];
    var valueNode = node.nodes[1].nodes[1];
    if (propertyNode.type === 'name' && propertyNode.value === 'key' &&
        valueNode.type === 'string') {
      return valueNode.value;
    } else {
      return {};
    }
  },
  call_in: function (node, copile) {
    var propertyNode = node.nodes[1].nodes[0];
    var arrayNode = node.nodes[1].nodes[1];
    if (propertyNode.type === 'name' && propertyNode.value === 'key' &&
        arrayNode.type === 'array') {
      var valueNodes = arrayNode.nodes;
      return valueNodes.map(function (valueNode) {
        if (valueNode.type === 'string') {
          return valueNode.value;
        } else {
          return {};
        }
      });
    } else {
      return {};
    }
  },
  node: function (node, compile) {
    return {};
  }
});

exports.filterToKeys = function (filter) {
  var keys;
  try {
    keys = filterToKeysCompile(filter);
  } catch (err) {
    return null;
  }
  var isOnlyKeys = keys.reduce(function (prev, next) {
    return prev && (typeof next === 'string');
  }, true);
  if (isOnlyKeys) {
    return keys;
  } else {
    return null;
  }
};

exports.parseJSON = function (json, key) {
  try {
    return JSON.parse(json);
  } catch (e) {
    throw new error.ReadError({key: key});
  }
};

exports.matchFilter = funql.compiler({
  'wrap_root': function (node, compile, context) {
    return compile(node, {
      key: context.key,
      tag: context.tag
    });
  },
  'call_or': function (node, compile) {
    var args = node.nodes[1].nodes;
    return compile(args).reduce(function (prev, curr) {
      return prev || curr;
    });
  },
  'call_and': function (node, compile) {
    var args = node.nodes[1].nodes;
    return compile(args).reduce(function (prev, curr) {
      return prev && curr;
    });
  },
  'call_in': function (node, compile) {
    var args = node.nodes[1].nodes;
    var valueToCheck = compile(args[0]);
    return compile(args[1], {parent: 'in'}).some(function (valueToCompare) {
      if (valueToCheck === valueToCompare) {
        return true;
      } else {
        return false;
      }
    });
  },
  'call_eq': function (node, compile, context) {
    var args = node.nodes[1].nodes;
    return compile(args[0]) === compile(args[1]);
  },
  'call_gt': function (node, compile) {
    var args = node.nodes[1].nodes;
    return compile(args[0]) > compile(args[1]);
  },
  'call_lt': function (node, compile) {
    var args = node.nodes[1].nodes;
    return compile(args[0]) < compile(args[1]);
  },
  'call_startsWith': function (node, compile) {
    var args = node.nodes[1].nodes;
    var value = compile(args[0]);
    var prefix = compile(args[1]);
    return value.substring(0, prefix.length) === prefix;
  },
  'name': function (node, compile, context) {
    return context[node.value];
  },
  'array': function (node, compile) {
    return compile(node.nodes);
  },
  'value': function (node, compile) {
    return node.value;
  }
});

exports.streamToPromise = function (stream) {
  return q.promise(function (resolve, reject) {
    var results = [];
    var errors = [];
    stream.on('error', function (err) {
      errors.push(err);
    });
    stream.on('data', function (data) {
      results.push(data);
    });
    stream.on('end', function () {
      if (errors.length === 1) {
        reject(errors[0]);
      } else if (errors.length > 1) {
        reject(errors);
      } else {
        resolve(results);
      }
    });
  });
};

exports.promiseToStream = function (promise) {
  var stream = new Readable({objectMode: true});
  q.when(promise)
    .then(function (results) {
      if (Array.isArray(results)) {
        results.forEach(function (result) {
          stream.push(result);
        });
      } else {
        stream.push(results);
      }
    })
    .fail(function (err) {
      stream.emit('error', err);
      stream.push(null);
    });
};

exports.slice = function (array) {
  return Array.prototype.slice.apply(
    array,
    Array.prototype.slice.call(arguments, 1)
  );
};

exports.isPromise = function (promise) {
  return promise && (typeof promise === 'object') &&
    (typeof promise.then === 'function');
};

exports.isReadStream = function (stream) {
  return stream && (typeof stream === 'object') &&
    (typeof stream.read === 'function' && typeof stream.abort === 'function');
};

exports.throttlePromises = function (functions, max) {
  return q.promise(function (resolve, reject) {
    var results = [];
    var running = 0;
    var waitingAt;
    function next(i) {
      if (running > max) {
        waitingAt = i;
      } else if (i < functions.length) {
        var result = functions[i]();
        results.push(result);
        result.then(completeTask, completeTask);
      } else {
        resolve(q.all(results));
      }
    }
    next(0);
    function completeTask() {
      if (waitingAt) {
        next(waitingAt);
        waitingAt = null;
      }
    }
  });
};

exports.createReady = function (init) {
  var isReady = false;
  var initDefer = q.defer();

  var ready = function () {
    if (isReady) {
      return q.fulfill(true);
    } else {
      return initDefer.promise;
    }
  };

  function tryInit() {
    init()
      .then(function () {
        isReady = true;
        initDefer.resolve(true);
      })
      .fail(function (err) {
        initDefer.reject(err);
        // try again
        initDefer = q.defer();
        tryInit();
      });
  }

  tryInit();

  return ready;
};

exports.defaultSource = function (msg) {
  throw new error.NotFound({key: msg.key});
};