var keydb = require('./lib/keydb');

keydb.driver('stack', require('./lib/drivers/stack'));
keydb.driver('async', require('./lib/drivers/async'));
keydb.driver('memory', require('./lib/drivers/memory'));
keydb.driver('sync-memory', require('./lib/drivers/sync-memory'));
keydb.driver('keys', require('./lib/drivers/keys'));
keydb.driver('sync-keys', require('./lib/drivers/sync-keys'));
keydb.driver('mysql', require('./lib/drivers/mysql'));
keydb.driver('upsert', require('./lib/drivers/upsert'));
keydb.driver('version', require('./lib/drivers/version'));
keydb.driver('table', require('./lib/drivers/table'));
keydb.driver('kv-mysql', require('./lib/drivers/kv-mysql'));
keydb.driver('mount-keys', require('./lib/drivers/mount-keys'));
keydb.driver('sync-mount-keys', require('./lib/drivers/sync-mount-keys'));

module.exports = keydb;