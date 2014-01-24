// async wrapper around mount-keys
var keydb = require('../keydb');

module.exports = function () {
  return keydb('mount-keys', {sync: true});
};