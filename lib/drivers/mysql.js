var q = require('q');
var mysql = require('mysql');
var funql = require('funql');
var stream = require('stream');
var Transform = stream.Transform;
var Writable = stream.Writable;
var Readable = stream.Readable;
var error = require('../error');

var MySqlDriver = function () {
};

var proto = MySqlDriver.prototype;

var query = function (connection, sql, params) {
  params = params || [];
  return q.promise(function (resolve, reject) {
    connection.query(sql, params, function (err, rows) {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
};

proto._createDatabase = function () {
  var sql = 'create database if not exists ' + this.database;
  return query(this.connection, sql);
};

proto._createTable = function (name, columns) {
  var self = this;
  var sql = 'create table if not exists ' + this.database + '.' + name + ' (';
  columns.forEach(function (column, i) {
    if (i > 0) {
      sql += ', ';
    }
    sql += ' ' + column;
  });
  sql += ')';
  return q.when(query(self.connection, sql));
};

proto._ensureColumn = function (tableName, column) {
  var self = this;
  var sql = 'alter table ' + this.database + '.' + tableName +
    ' add ' + column;
  return q.when(query(self.connection, sql))
    .fail(function (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        // column is already there
        return;
      } else {
        throw err;
      }
    });
};

proto.config = function (config) {
  var self = this;
  self.connection = mysql.createConnection({
    host     : config.hostname || process.env.KEYDB_DRIVERS_MYSQL_HOSTNAME || process.env.RDS_HOSTNAME || 'localhost',
    user     : config.username || process.env.KEYDB_DRIVERS_MYSQL_USERNAME || process.env.RDS_USERNAME || 'root',
    password : config.password || process.env.KEYDB_DRIVERS_MYSQL_PASSWORD || process.env.RDS_PASSWORD || '',
    port     : config.port || process.env.KEYDB_DRIVERS_MYSQL_PORT || process.env.RDS_PORT || 3306,
    charset  : 'utf8'
  });
  self.id = config.id;
  self.database = config.database || config.id;
  return self.init();
};

proto.init = function () {
  var self = this;
  var modifiedTimeColumn = 'modified_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP';
  return self._createDatabase()
    .then(function () {
      return self._createTable('item', [
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
        return self._ensureColumn('item', modifiedTimeColumn);
      }
    });
};

proto._tableId = function (tableName) {
  return mysql.escapeId(this.database + '.' + tableName);
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

var transformResultToMessage = function (row, encoding, done) {
  var message = rowToObject(row);
  message.key = row.item_key;
  message.version = row.version;
  message.tag = row.tag;
  message.modifiedTime = row.modified_time;
  this.push(message);
  done();
};

var comparison = function (node, compile, op) {
  var args = node.nodes[1].nodes;
  var left = compile(args[0]);
  var right = compile(args[1]);
  return ' ( ' + left + ' ' + op + ' ' + right + ' ) ';
};

var compileExpression = funql.compiler({
  'call_or': function (node, compile) {
    var args = node.nodes[1].nodes;
    return ' ( ' + compile(args).join(' or ') + ' ) ';
  },
  'call_and': function (node, compile) {
    var args = node.nodes[1].nodes;
    return ' ( ' + compile(args).join(' and ') + ' ) ';
  },
  'call_in': function (node, compile) {
    var args = node.nodes[1].nodes;
    return compile(args[0]) + ' in ' + compile(args[1], {parent: 'in'});
  },
  'call_eq': function (node, compile) {
    return comparison(node, compile, '=');
  },
  'call_gt': function (node, compile) {
    return comparison(node, compile, '>');
  },
  'call_lt': function (node, compile) {
    return comparison(node, compile, '<');
  },
  'call_gte': function (node, compile) {
    return comparison(node, compile, '>=');
  },
  'call_lte': function (node, compile) {
    return comparison(node, compile, '<=');
  },
  'call_startsWith': function (node, compile) {
    var args = node.nodes[1].nodes;
    var value = compile(args[0]);
    var prefix = compile(args[1]);
    return " ( substring(" + value + ", 1 ,char_length(" + prefix + ")) = " + prefix + ") ";
  },
  'name_key': function (node, compile) {
    return 'item_key';
  },
  'name_tag': function (node, compile) {
    return 'tag_key';
  },
  'array': function (node, compile) {
    return ' ( ' + compile(node.nodes).join(' , ') + ' ) ';
  },
  'string': function (node, compile) {
    return mysql.escape(node.value);
  }
});

proto.query = function (filter) {
  var self = this;
  var transform = new Transform({objectMode: true});
  transform._transform = transformResultToMessage.bind(transform);
  var sql = "select * ";
  sql += ' from ' + self._tableId('item');
  sql += ' where ';
  sql += compileExpression(filter);
  q.promise(function (resolve, reject) {
    self.connection.query(sql).stream().pipe(transform);
  })
    .fail(function (err) {
    var stub = new Readable({objectMode: true});
    stub._read = function () {
      process.nextTick(function () {
        transform.emit('error', err);
        stub.push(null);
        transform.end();
      });
    };
    stub.pipe(transform);
  });
  return transform;
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

// TODO: make this safer for concurrency
proto._setViews = function (command, views) {
  var self = this;
  var sourceKey = command.key;
  return q.when(true)
    .then(function () {
      if (views && views.length > 0) {
        var sql = [
          'insert into ' + self._tableId('item'),
          '(item_key, tag_key, value_type, media_value, media_type, version, source_key)',
          'values ' + views.map(function (view) {
            var valueFields = valueToRow(view);
            return '(' + mysql.escape([
              view.key,
              view.tag || null,
              valueFields.value_type,
              valueFields.media_value,
              valueFields.media_type,
              command.version,
              sourceKey
            ]) + ')';
          }),
          'on duplicate key update',
          'tag_key = values(tag_key),',
          'value_type = values(value_type),',
          'media_value = values(media_value),',
          'version = values(version),',
          'source_key = values(source_key)'
        ].join('\n');
        return query(self.connection, sql);
      }
    })
    .then(function () {
      // delete old views
      var sql = [
        'delete from ' + self._tableId('item'),
        'where source_key = ' + mysql.escape(sourceKey),
        'and version not in (',
        '  select version from (',
        '    select version from ' + self._tableId('item'),
        '    where item_key = ' + mysql.escape(sourceKey),
        '  ) as current_item',
        ')'
      ].join('\n');
      return query(self.connection, sql);
    });
};

proto.send_create = function (command, views) {
  var self = this;
  var valueFields = valueToRow(command);
  var sql = 'insert into ' + self._tableId('item');
  sql += ' (item_key, tag_key, value_type, media_value, media_type, version) select ';
  sql += ' ' + mysql.escape(command.key);
  sql += ', ' + mysql.escape(command.tag || null);
  sql += ', ' + mysql.escape(valueFields.value_type);
  sql += ', ' + mysql.escape(valueFields.media_value);
  sql += ', ' + mysql.escape(valueFields.media_type);
  sql += ', ' + mysql.escape(command.version);
  sql += ' from dual where not exists ( select * from ' + self._tableId('item');
  sql += ' where item_key = ' + mysql.escape(command.key);
  sql += ')';
  return query(self.connection, sql)
    .then(function (result) {
      if (result.affectedRows > 0) {
        return {};
      } else {
        throw new error.CreateConflict({key: command.key});
      }
    })
    .then(function () {
      return self._setViews(command, views);
    });
};

proto.send_update = function (command, views) {
  var self = this;
  var valueFields = valueToRow(command);
  var sql = 'update ' + self._tableId('item') + ' ';
  sql += 'set item_key = ' + mysql.escape(command.key) + ' ';
  sql += ', tag_key = ' + mysql.escape(command.tag || null) + ' ';
  sql += ', value_type = ' + mysql.escape(valueFields.value_type) + ' ';
  sql += ', media_value = ' + mysql.escape(valueFields.media_value) + ' ';
  sql += ', media_type = ' + mysql.escape(command.mediaType) + ' ';
  sql += ', version = ' + mysql.escape(command.version) + ' ';
  sql += 'where item_key = ' + mysql.escape(command.key) + ' ';
  if (command.ifVersion) {
    sql += 'and version = ' + mysql.escape(command.ifVersion) + ' ';
  }
  console.log('update:', sql);
  return query(self.connection, sql)
    .then(function (result) {
      if (result.affectedRows > 0) {
        return {};
      } else {
        throw new error.UpdateFailure({key: command.key, version: command.ifVersion});
      }
    })
    .then(function () {
      return self._setViews(command, views);
    });
};

if (process.env.KEYDB_MODE === 'UNSAFE') {
  proto.send_DELETE_ALL_DATA_FOREVER = function () {
    var self = this;
    console.log('>>> DELETE_ALL_DATA_FOREVER:' + self.database);
    if (process.env.KEYDB_MODE === 'UNSAFE') {
      return query(self.connection, 'drop database ' + mysql.escapeId(self.database))
        .then(function () {
          console.log('>>> deleted all data from: ' + self.database);
          return self.init();
        })
        .fail(function (err) {
          if (err.code === 'ER_DB_DROP_EXISTS') {
            console.log('>>> already deleted data from: ' + self.database);
            return;
          }
          console.log('>>> failed to delete all data from: ' + self.database);
          throw err;
        });
    } else {
      return q.reject('UNSAFE mode required to delete all data forever.');
    }
  };
}

proto.end = function () {
  var self = this;
  if (self.connection) {
    self.connection.end();
  }
  return q.when(true);
};

module.exports = function (config) {
  var driver = new MySqlDriver();
  return driver.config(config)
    .then(function () {
      return driver;
    });
};