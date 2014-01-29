var q = require('q');
var mysql = require('mysql');
var utils = require('../utils');
var error = require('../error');

var dbTypes = {
  string: function (prop) {
    if (prop.maxLength && prop.maxLength < 10000) {
      return 'varchar(' + prop.maxLength + ') collate latin1_bin';
    } else {
      return 'longblob';
    }
  }
};

var columnDef = function (table, key) {
  var prop = table.properties[key];
  var def = key + ' ' + dbTypes[prop.type](prop);
  if (table.required && Array.isArray(table.required) && table.required.indexOf(key) >= 0) {
    def += ' not null';
  }
  if (prop.default) {
    def += ' default ' + mysql.escape(prop.default);
  }
  return def;
};

var Db = function (options) {
  this.database = options.database || options.id || 'keydb';
  this.connection = mysql.createConnection({
    host     : options.hostname || process.env.KEYDB_DRIVERS_MYSQL_HOSTNAME || process.env.RDS_HOSTNAME || 'localhost',
    user     : options.username || process.env.KEYDB_DRIVERS_MYSQL_USERNAME || process.env.RDS_USERNAME || 'root',
    password : options.password || process.env.KEYDB_DRIVERS_MYSQL_PASSWORD || process.env.RDS_PASSWORD || '',
    port     : options.port || process.env.KEYDB_DRIVERS_MYSQL_PORT || process.env.RDS_PORT || 3306,
    charset  : 'utf8'
  });
};

Db.prototype = {
  query: function (sql, params) {
    var self = this;
    params = params || [];
    return q.promise(function (resolve, reject) {
      self.connection.query(sql, params, function (err, rows) {
        if (err) {
          return reject(err);
        }
        resolve(rows);
      });
    });
  },
  createDatabase: function () {
    var sql = 'create database if not exists ' + this.database;
    return this.query(sql);
  },
  createTable: function (name, columns) {
    var self = this;
    var sql = 'create table if not exists ' + self.database + '.' + name + ' (';
    sql += columns.join(', ');
    sql += ')';
    return q.when(self.query(sql));
  },
  ensureColumn: function (tableName, column) {
    var self = this;
    var sql = 'alter table ' + self.database + '.' + tableName +
      ' add ' + column;
    return q.when(self.query(sql))
      .fail(function (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          // column is already there
          return;
        } else {
          throw err;
        }
      });
  },
  tableId: function (tableName) {
    return mysql.escapeId(this.database + '.' + tableName);
  }
};

var createMySqlSource = function (next, options) {
  options = options || {};

  var db = new Db(options);

  var initDatabase = function () {
    return db.createDatabase();
  };

  var readyDatabase = utils.createReady(initDatabase);

  var makeInitTableFn = function (tableName) {
    return function () {
      var defs = [];
      var table = options.tables[tableName];
      if (!table) {
        throw new error.TableSchemaNotFound({table: tableName});
      }
      var props = table.properties;
      Object.keys(props).forEach(function (key) {
        defs.push(columnDef(table, key));
      });
      if (!table.primaryKey) {
        throw new error.PrimaryKeyRequired({table: tableName});
      }
      defs.push('primary key (' + table.primaryKey + ')');
      return db.createTable(tableName, defs)
        .then(function () {
          if (table.createdTime) {
            return db.ensureColumn(tableName, table.createdTime + ' TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
          }
        })
        .then(function () {
          if (table.modifiedTime) {
            return db.ensureColumn(tableName, table.modifiedTime + ' TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
          }
        })
        .then(function () {
          var promises = Object.keys(props).filter(function (key) {
            return key !== table.primaryKey;
          }).map(function (key) {
            return db.ensureColumn(tableName, columnDef(table, key));
          });
          return q.all(promises);
        });
    };
  };

  var readyTable = {};

  var ready = function (msg) {
    return readyDatabase()
      .then(function () {
        if (!msg.table) {
          return;
        }
        if (!readyTable[msg.table]) {
          readyTable[msg.table] = utils.createReady(makeInitTableFn(msg.table));
        }
        return readyTable[msg.table]();
      });
  };

  var reset = function () {
    readyDatabase = utils.createReady(initDatabase);
    readyTable = {};
  };

  var msgKeys = function (msg, attrs) {
    try {
      var primaryKeys = options.tables[msg.table].primaryKey;
      if (typeof primaryKeys === 'string') {
        primaryKeys = [primaryKeys];
      }
      primaryKeys.forEach(function (key) {
        if (!attrs[key]) {
          throw new error.PrimaryKeyRequiredForOp({op: msg.op});
        }
      });
      return primaryKeys;
    } catch (e) {
      throw new error.PrimaryKeyRequiredForOp({op: msg.op});
    }
  };

  var ops = {
    query: function (msg) {
      var sql = [
        'select',
        msg.attributes ? msg.attributes.join(',') : '*',
        'from ' + db.tableId(msg.table),
        'where',
        Object.keys(msg.filters).map(function (key) {
          return key + ' = ' + mysql.escape(msg.filters[key]);
        })
      ].join('\n');
      return db.query(sql)
        .then(function (results) {
          // Need to remove non-column properties.
          var items = [];
          return {
            items: results.map(function (result) {
              var obj = {};
              Object.keys(result).forEach(function (key) {
                obj[key] = result[key];
              });
              return obj;
            })
          };
        });
    },
    create: function (msg) {
      var sql = [
        'insert into ' + db.tableId(msg.table),
        '(' + Object.keys(msg.attributes).join(',') + ')',
        'select',
        Object.keys(msg.attributes).map(function (key) {
          return mysql.escape(msg.attributes[key]);
        }).join(','),
        'from dual where not exists',
        '(',
        'select * from ' + db.tableId(msg.table),
        'where ',
        msgKeys(msg, msg.attributes).map(function (key) {
          return key + ' = ' + mysql.escape(msg.attributes[key]);
        }).join(','),
        ')'
      ].join('\n');
      return db.query(sql)
        .then(function (result) {
          if (result.affectedRows > 0) {
            return {};
          } else {
            throw new error.CreateConflict({key: msg.key});
          }
        });
    },
    update: function (msg) {
      var sql = [
        'update ' + db.tableId(msg.table),
        'set ',
        Object.keys(msg.attributes).map(function (key) {
          return key + ' = ' + mysql.escape(msg.attributes[key]);
        }).join(','),
        'where',
        msgKeys(msg, msg.filters).map(function (key) {
          return key + ' = ' + mysql.escape(msg.filters[key]);
        }).join(',')
      ].join('\n');
      return db.query(sql)
        .then(function (result) {
          if (result.affectedRows > 0) {
            return {};
          } else {
            throw new error.UpdateFailure({key: msg.key, version: msg.ifVersion});
          }
        });
    },
    delete: function (msg) {
      var sql = [
        'delete from ' + db.tableId(msg.table),
        'where',
        msgKeys(msg, msg.filters).map(function (key) {
          return key + ' = ' + mysql.escape(msg.filters[key]);
        }).join(',')
      ].join('\n');
      return db.query(sql)
        .then(function (result) {
          if (result.affectedRows > 0) {
            return {};
          } else {
            throw new error.NotFound({key: msg.key});
          }
        });
    },
    'delete-database': function (msg) {
      return db.query('drop database ' + mysql.escapeId(options.database))
        .then(function () {
          console.log("DELETED ALL DATA FOREVER FROM: " + options.database);
          reset();
        });
    }
  };

  var source = function (msg) {
    return ready(msg)
      .then(function () {
        return ops[msg.op](msg);
      });
  };

  return source;
};

module.exports = createMySqlSource;