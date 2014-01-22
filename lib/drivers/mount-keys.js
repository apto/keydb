var bs = require('binary-search');
var error = require('../error');
var _ = require('underscore');

var createMountKeysSource = function (next, options) {

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

  var source = function (msg) {
    var mount = findMount(msg);
    if (mount === null) {
      throw new error.NotFound({key: msg.key});
    }
    msg = _.extend({}, msg);
    msg.key = msg.key.substring(mount.key.length);
    return mount.source(msg);
  };

  source.mount = function (key, source) {
    mounts.push({
      key: key,
      source: source
    });
  };

  return source;
};

module.exports = createMountKeysSource;