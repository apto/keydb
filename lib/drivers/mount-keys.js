var bs = require('binary-search');
var error = require('../error');
var _ = require('underscore');

var createMountKeysSource = function (next, options) {

  options = options || {};
  var mounts = [];

  var findMount = function (msg) {
    if (!msg.key) {
      return null;
    }
    var matchMount = null;
    mounts.forEach(function (mount) {
      if (mount.key.length < msg.key.length) {
        if (msg.key.substring(0, mount.key.length) === mount.key) {
          if (matchMount === null || mount.key.length > matchMount.key.length) {
            matchMount = mount;
          }
        }
      }
    });
    return matchMount;
  };

  var source = function (originalMsg) {
    var mount = findMount(originalMsg);
    if (mount === null) {
      throw new error.NotFound({key: originalMsg.key});
    }
    var msg = _.extend({}, originalMsg);
    msg.key = originalMsg.key.substring(mount.key.length);
    msg = _.extend(msg, mount.msg);

    var fixResult = function (resultMsg) {
      resultMsg = _.extend({}, resultMsg);
      resultMsg.key = originalMsg.key;
      Object.keys(mount.msg).forEach(function (key) {
        delete resultMsg[key];
      });
      if (resultMsg.type === 'collection') {
        var prefix = originalMsg.key.substring(0, mount.key.length);
        resultMsg.value = resultMsg.value.map(function (ref) {
          return _.extend({}, ref, {key: prefix + ref.key});
        });
      }
      return resultMsg;
    };

    if (options.sync) {
      return fixResult(mount.source(msg));
    } else {
      return mount.source(msg)
        .then(fixResult);
    }
  };

  source.mount = function (key, source, options) {
    options = options || {};
    mounts.push({
      key: key,
      source: source,
      msg: options.msg || {}
    });
  };

  return source;
};

module.exports = createMountKeysSource;