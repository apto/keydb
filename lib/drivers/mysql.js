var q = require('q');
var mysql = require('mysql');
var funql = require('funql');
var stream = require('stream');
var Transform = stream.Transform;
var Writable = stream.Writable;
var Readable = stream.Readable;

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
  var sql = 'create database if not exists ' + this.id;
  return query(this.connection, sql);
};

proto._createTable = function (name, columns) {
  var self = this;
  var sql = 'create table if not exists ' + this.id + '.' + name + ' (';
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
  var sql = 'alter table ' + this.id + '.' + tableName +
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
    host     : config.hostname || 'localhost',
    user     : config.username || 'root',
    password : config.password || '',
    port     : config.port || 3306,
    charset  : 'utf8'
  });
  self.id = config.id;
  self.database = config.database || config.id;
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

proto.send = function (command) {

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