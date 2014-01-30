var uuid64 = require('uuid64');
var funql = require('funql');
var error = require('./error');
var q = require('q');
var stream = require('./stream');
var Readable = stream.Readable;
var streamifier = require('streamifier');

var utils = exports;

exports.isValidKey = function (key) {
  if (!key || key === '') {
    return false;
  }
  return true;
};

exports.validateKey = function (key) {
  if (!utils.isValidKey(key)) {
    throw new error.InvalidKeyError({key: ''});
  }
};

exports.parseJSON = function (json, key) {
  try {
    return JSON.parse(json);
  } catch (e) {
    throw new error.ReadError({key: key});
  }
};

exports.slice = function (array) {
  return Array.prototype.slice.apply(
    array,
    Array.prototype.slice.call(arguments, 1)
  );
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
  throw new error.NotFound({key: msg ? msg.key : undefined});
};

exports.isReadStream = function (stream) {
  return stream instanceof Readable;
};

exports.isPromise = function (promise) {
  return promise && (typeof promise === 'object') &&
    (typeof promise.then === 'function');
};

exports.isBuffer = function (buffer) {
  return buffer instanceof Buffer;
};

exports.streamToStringPromise = function (stream) {
  return utils.streamToBufferPromise(stream)
    .then(function (buffer) {
      return buffer.toString();
    });
};

exports.streamToBufferPromise = function (stream) {
  return q.promise(function (resolve, reject) {

    var buffers = [];
    var errors = [];

    stream
      .on('error', function (err) {
        errors.push(err);
      })
      .on('readable', function () {
        var data;
        while (null !== (data = stream.read())) {
          if (typeof data === 'string') {
            data = new Buffer(data);
          }
          buffers.push(data);
        }
      })
      .on('end', function () {
        if (errors.length === 1) {
          reject(errors[0]);
        } else if (errors.length > 1) {
          reject(errors);
        } else {
          var buffer = Buffer.concat(buffers);
          resolve(buffer);
        }
      });

    stream.resume();
  });
};

exports.stringPromise = function (value) {
  if (typeof value === 'string') {
    return q(value);
  } else if (utils.isReadStream(value)) {
    return utils.streamToStringPromise(value);
  } else if (utils.isBuffer(value)) {
    return q(value.toString());
  } else {
    return q(value);
  }
};

exports.bufferPromise = function (value) {
  if (typeof value === 'string') {
    return q(new Buffer(value));
  } else if (utils.isBuffer(value)) {
    return q(value);
  } else if (utils.isReadStream(value)) {
    return utils.streamToBufferPromise(value);
  } else {
    return q(value);
  }
};

exports.bufferToStream = function (buffer) {
  return streamifier.createReadStream(buffer);
};

exports.valueStream = function (value) {
  if (value instanceof Readable) {
    return value;
  } else if (value instanceof Buffer) {
    return utils.bufferToStream(value);
  } else if (typeof value === 'string') {
    return utils.bufferToStream(new Buffer(value));
  } else {
    return value;
  }
};