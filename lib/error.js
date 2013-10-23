var errman = require('errman')();

errman.registerType('InvalidKey', {
  status: 400,
  code: 'invalid_key',
  message: 'Invalid key: {{key}}'
});

errman.registerType('ReadFailure', {
  status: 500,
  code: 'read_failure',
  message: 'Failed to read key: {{key}}'
});

errman.registerType('UpsertFailure', {
  status: 500,
  code: 'upsert_failure',
  message: 'Failed to upsert: {{key}}'
});

errman.registerType('UpdateFailure', {
  status: 500,
  code: 'update_failure',
  message: 'Failed to update: {{key}}, version: {{version}}'
});

errman.registerType('CommandNotFound', {
  status: 400,
  code: 'command_not_found',
  message: 'Command not found: {{op}}'
});

errman.registerType('CreateConflict', {
  status: 409,
  code: 'create_conflict',
  message: 'Create failed due to conflict for existing key: {{key}}'
});

module.exports = errman;