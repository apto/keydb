var _ = require('underscore');
var createKeysSource = require('./keys');

module.exports = function (next, options) {
  options = options || {};
  options = _.extend({sync: true}, options);
  return createKeysSource(next, options);
};