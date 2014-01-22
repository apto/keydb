// async wrapper around mount-keys
var keydb = require('../keydb');

module.exports = function () {
  return keydb()
    .driver(keydb.drivers.async)
    .source(keydb('mount-keys'));
};