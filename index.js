var api = require('./lib/api');

api.driver('mysql', require('./lib/drivers/mysql'));

module.exports = api;