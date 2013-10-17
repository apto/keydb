var errman = require('errman')();

errman.registerType('InvalidKeyError', {
  message: 'Invalid key: {{key}}',
  code: 'invalid_key'
});

errman.registerType('ReadError', {
  message: 'Failed to read key: {{key}}',
  code: 'read_failure'
});

module.exports = errman;