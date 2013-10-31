var uuid64 = require('uuid64');

module.exports = function (next) {
  return function (msg) {
    msg.version = msg.version || uuid64();
    return next(msg);
  };
};