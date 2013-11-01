var q = require('q');
var mysql = require('mysql');
var utils = require('../utils');
var error = require('../error');

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
    columns.forEach(function (column, i) {
      if (i > 0) {
        sql += ', ';
      }
      sql += ' ' + column;
    });
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

var valueToRow = function (command) {
  var row = {
    media_value: null,
    media_type: null
  };
  if (command.isBinary) {
    row.value_type = 'bin';
    row.media_type = command.mediaType;
    // TODO: need to parse base64, blah, blah
  } else if (command.mediaType) {
    row.value_type = 'txt';
    row.media_type = command.mediaType;
    row.media_value = command.value;
  } else if (typeof command.value === 'string') {
    row.value_type = 'str';
    row.media_value = command.value;
  } else if (typeof command.value === 'number') {
    row.value_type = 'num';
    row.media_value = JSON.stringify(command.value);
  } else if (typeof command.value === 'boolean') {
    row.value_type = 'bool';
    row.media_value = JSON.stringify(command.value);
  } else if (typeof command.value === 'undefined' || command.value === 'null') {
    row.value_type = 'null';
  } else {
    row.value_type = 'json';
    row.media_value = JSON.stringify(command.value);
  }
  return row;
};

var rowToObject = function (row) {
  var obj = {value: null};
  if (row.value_type === 'bin') {
    obj.isBinary = true;
    obj.mediaType = row.media_type;
    // TODO: convert to base64, blah, blah
  } else if (row.value_type === 'txt') {
    obj.mediaType = row.media_type;
    obj.value = row.media_value.toString();
  } else if (row.value_type === 'str') {
    obj.value = row.media_value.toString();
  } else if (row.value_type === 'num') {
    obj.value = JSON.parse(row.media_value.toString());
  } else if (row.value_type === 'bool') {
    obj.value = JSON.parse(row.media_value.toString());
  } else if (row.value_type === 'null') {
    obj.value = null;
  } else if (row.value_type === 'json') {
    // cross fingers
    obj.value = JSON.parse(row.media_value.toString());
  } else {
    obj.value = null;
  }
  return obj;
};

var createMySqlSource = function (next, options) {
  options = options || {};

  var db = new Db(options);

  var init = function () {
    var modifiedTimeColumn = 'modified_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP';
    return db.createDatabase()
      .then(function () {
        return db.createTable('item', [
          'item_key varchar(500) collate latin1_bin',
          'tag_key varchar(500) collate latin1_bin',
          'value_type varchar(8)',
          'media_value longblob',
          'media_type varchar(250)',
          'version varchar(50) not null',
          'source_key varchar(500) collate latin1_bin',
          'primary key (item_key)',
          'modified_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
          'index(source_key)'
        ]);
      })
      .then(function (result) {
        if (result.warningCount === 1) {
          // table was already created
          return db.ensureColumn('item', modifiedTimeColumn);
        }
      });
  };

  // make a function that will return a promise that resolves when initialized
  var ready = utils.createReady(init);

  var ops = {
    get: function (msg) {
      if (msg.keys) {
        return ops.getKeys(msg);
      }
      var sql = [
        'select * from ' + db.tableId('item'),
        'where',
        'item_key = ' + mysql.escape(msg.key)
      ].join('\n');
      return db.query(sql)
        .then(function (result) {
          if (result.length < 1) {
            throw new error.NotFound({key: msg.key});
          }
          var reply = rowToObject(result[0]);
          reply.key = msg.key;
          return reply;
        });
    },
    getKeys: function (msg) {
      var prefix = msg.key || '';
      var keys = msg.keys.map(function (key) {
        return prefix + key;
      });
    },
    create: function (msg) {
      var valueFields = valueToRow(msg);
      var sql = 'insert into ' + db.tableId('item');
      sql += ' (item_key, tag_key, value_type, media_value, media_type, version) select ';
      sql += ' ' + mysql.escape(msg.key);
      sql += ', ' + mysql.escape(msg.tag || null);
      sql += ', ' + mysql.escape(valueFields.value_type);
      sql += ', ' + mysql.escape(valueFields.media_value);
      sql += ', ' + mysql.escape(valueFields.media_type);
      sql += ', ' + mysql.escape(msg.version);
      sql += ' from dual where not exists ( select * from ' + db.tableId('item');
      sql += ' where item_key = ' + mysql.escape(msg.key);
      sql += ')';
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
      var valueFields = valueToRow(msg);
      var sql = 'update ' + db.tableId('item') + ' ';
      sql += 'set item_key = ' + mysql.escape(msg.key) + ' ';
      sql += ', tag_key = ' + mysql.escape(msg.tag || null) + ' ';
      sql += ', value_type = ' + mysql.escape(valueFields.value_type) + ' ';
      sql += ', media_value = ' + mysql.escape(valueFields.media_value) + ' ';
      sql += ', media_type = ' + mysql.escape(msg.mediaType) + ' ';
      sql += ', version = ' + mysql.escape(msg.version) + ' ';
      sql += 'where item_key = ' + mysql.escape(msg.key) + ' ';
      if (msg.ifVersion) {
        sql += 'and version = ' + mysql.escape(msg.ifVersion) + ' ';
      }
      return db.query(sql)
        .then(function (result) {
          if (result.affectedRows > 0) {
            return {};
          } else {
            throw new error.UpdateFailure({key: msg.key, version: msg.ifVersion});
          }
        });
    }
  };

  var source = function (msg) {
    return ready()
      .then(function () {
        return ops[msg.op](msg);
      });
  };

  return source;
};

module.exports = createMySqlSource;