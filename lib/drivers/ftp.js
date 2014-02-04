var keydb = require('keydb'),
    q = require('q'),
    JSFtp = require("jsftp"),
    utils = require('../utils'),
    error = require('../error'),
    stream = require('stream');

var ftp = function (options) {
  return new JSFtp({
    host: options.hostname || process.env.KEYDB_DRIVERS_MYSQL_HOSTNAME || process.env.RDS_HOSTNAME || 'localhost',
    user: options.username || process.env.KEYDB_DRIVERS_MYSQL_USERNAME || process.env.RDS_USERNAME || 'samals',
    pass: options.password || process.env.KEYDB_DRIVERS_MYSQL_PASSWORD || process.env.RDS_PASSWORD || 'bapuna@44',
    port: options.port || process.env.KEYDB_DRIVERS_MYSQL_PORT || process.env.RDS_PORT || 21
  });
};

var db = keydb();

var createFTPSource = function (next, options) {
  options = options || {};

  var _ftp  = ftp(options);

  var Ftp = {
    raw: _ftp.raw,
    ls: q.nbind(_ftp.ls, _ftp),
    get: q.nbind(_ftp.get, _ftp),
    put: q.nbind(_ftp.put, _ftp)
  };


  var ops = {
    get: function (msg) {
      function response(key, type, value) {
        return {
          key : key,
          type : (type === "collection") ? "collection" : "file",
          value : value
        };
      }

      return Ftp.ls(msg.key).then(function (res) {

        if (res.length === 0) {
          throw new error.NotFound({key: msg.key});
        }
        // For a file it comes with a list having only one element with 
        // type file.
        if (res.length === 1 && !res[0].type) {

          return Ftp.get(msg.key).then(function (socket) {

            // Just add a call back on close of the scoket
            // so that it quits the FTP connection.
            socket.on("close", function (hadErr) {
              // Exit the FTP connection
              Ftp.raw.quit();
            });

            // as this is a passive socket, just resume it.
            socket.resume();
            var Readable = stream.Readable;
            // Returns the filepath as the key and the scoket stream
            // as the value
            return response(msg.key, "file", new Readable().wrap(socket));
          });

        } else {

          // for the directory return the basic data for each child
          var props = [];
          res.forEach(function (e) {

            // Add a map for each child
            props.push({
              key : e.name,
              type : (e.type) ? "collection" : "file"
            });
          });
          // quit the ftp connection
          Ftp.raw.quit();

          return response(msg.key, "collection", props);

        }
      }).fail(function (err) {
          throw new error.NotFound({key: msg.key});
        });
    },
    meta : function (msg) {
      // Returns whatever metadata comes with ls.
      return Ftp.ls(msg.key).then(function (res) {
        if (res.length === 0) {
          throw new error.NotFound({key: msg.key});
        }
        Ftp.raw.quit();
        return {
          key : msg.key,
          type : (res.length === 1 && !res[0].type) ? "collection" : "file"
        };
      });
    },
    set : function (msg) {
      return Ftp.put(msg.value, msg.key).then(function (a) {
        Ftp.raw.quit();
        return {
          key : msg.key
        };
      }).fail(function (err) {
        throw new error.UpsertFailure({key: msg.key});
      });
    }
  };

  var source = function (msg) {
    if (ops[msg.op]) {
      return ops[msg.op](msg);
    } else {
      return next(msg);
    }
  };
  return source;
};

module.exports = createFTPSource;


