var errman = require('errman')();

errman.registerType('InvalidDriver', {
  status: 500,
  code: 'invalid_driver',
  message: 'An invalid driver was added to a stack.'
});

errman.registerType('TableSchemaNotFound', {
  status: 500,
  code: 'table_schema_not_found',
  message: 'No table schema defined for table: {{table}}'
});

errman.registerType('PrimaryKeyRequired', {
  status: 500,
  code: 'primary_key_required',
  message: 'No primary key defined for table: {{table}}'
});

errman.registerType('PrimaryKeyRequiredForOp', {
  status: 500,
  code: 'primary_key_required_for_op',
  message: 'No primary key defined for operation: {{op}}'
});

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

errman.registerType('NotFound', {
  status: 404,
  code: 'not_found',
  message: 'Not found: {{key}}'
});

errman.registerType('QueryNotSupported', {
  status: 400,
  code: 'query_not_supported',
  message: 'Query not supported: {{filter}}'
});

module.exports = errman;