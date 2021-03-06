// async wrapper around tree memory
var keydb = require('../keydb');

module.exports = function () {
  return keydb()
    .driver(keydb.drivers.media)
    .driver(keydb.drivers.buffer)
    .driver(keydb.drivers.async)
    .driver(keydb.drivers.syncTreeMemory);
};