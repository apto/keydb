var keydb = require('./lib/keydb');

keydb.driver('stack', require('./lib/drivers/stack'));
keydb.driver('async', require('./lib/drivers/async'));
keydb.driver('memory', require('./lib/drivers/memory'));
keydb.driver('syncKeys', require('./lib/drivers/sync-keys'));
keydb.driver('mysql', require('./lib/drivers/mysql'));
keydb.driver('upsert', require('./lib/drivers/upsert'));
keydb.driver('version', require('./lib/drivers/version'));

module.exports = keydb;