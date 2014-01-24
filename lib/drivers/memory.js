// async wrapper around memory
var keydb = require('../keydb');

module.exports = function () {
  return keydb()
    .driver(keydb.drivers.async)
    .driver(keydb.drivers.syncMemory);
};