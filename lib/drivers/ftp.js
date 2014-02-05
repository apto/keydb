var keydb = require('../keydb'),
    q = require('q'),
    JSFtp = require("jsftp"),
    utils = require('../utils'),
    error = require('../error'),
    stream = require('stream');

var jsFtp = function (options) {
  return new JSFtp({
    host: options.hostname || 'localhost',
    user: options.username,
    pass: options.password,
    port: options.port ||  21
  });
};

var db = keydb();

var createFTPSource = function (next, options) {
  options = options || {};

  var _ftp  = jsFtp(options);

  var ftp = {
    raw: _ftp.raw,
    ls: q.nbind(_ftp.ls, _ftp),
    get: q.nbind(_ftp.get, _ftp),
    put: q.nbind(_ftp.put, _ftp),
    mkdir: q.nbind(_ftp.raw.mkd, _ftp.raw),
    delete: q.nbind(_ftp.raw.dele, _ftp.raw)
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
      return ftp.ls(msg.key).then(function (res) {

        if (res.length === 0) {
          throw new error.NotFound({key: msg.key});
        }
        // For a file it comes with a list having only one element with 
        // type file.
        if (res.length === 1 && !res[0].type) {

          return ftp.get(msg.key).then(function (socket) {

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

          return response(msg.key, "collection", props);

        }
      }).fail(function (err) {
          throw new error.NotFound({key: msg.key});
        });
    },
    meta : function (msg) {
      // Returns whatever metadata comes with ls.
      return ftp.ls(msg.key).then(function (res) {
        if (res.length === 0) {
          throw new error.NotFound({key: msg.key});
        }
        return {
          key : msg.key,
          type : (res.length === 1 && !res[0].type) ? "file" : "collection"
        };
      });
    },
    set : function (msg) {
      if (msg.type === "collection") {
        return ftp.mkdir(msg.key)
        .fail(function (err) {
          throw new error.UpsertFailure({key: msg.key});
        });
      }
      return ftp.put(msg.value, msg.key).then(function (a) {
        return {
          key : msg.key
        };
      }).fail(function (err) {
        throw new error.UpsertFailure({key: msg.key});
      });
    },
    delete : function (msg) {
      return ftp.delete(msg.key)
        .fail(function (err) {
          throw new error.UpdateFailure({key: msg.key});
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


