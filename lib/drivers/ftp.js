var keydb = require('../keydb'),
    q = require('q'),
    JSFtp = require("jsftp"),
    utils = require('../utils'),
    error = require('../error'),
    _ = require('underscore'),
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
    delete: q.nbind(_ftp.raw.dele, _ftp.raw),
    rename: q.nbind(_ftp.rename, _ftp)
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
        var isFile = res.length === 1 && !res[0].type;
        return {
          key : msg.key,
          type : (isFile) ? "file" : "collection",
          size : (isFile) ? res[0].size : undefined
        };
      });
    },
    set : function (msg) {
      if (msg.type === "collection") {
        return ftp.mkdir(msg.key)
        .fail(function (err) {

          throw new error.UpsertFailure({key: msg.key});
        });
      } else {
        return ftp.put(msg.value, msg.key).then(function (res) {
          return {
            key : msg.key
          };
        }).fail(function (err) {
          throw new error.UpsertFailure({key: msg.key});
        });
      }
    },
    move : function (msg) {
      return ftp.rename(msg.key, msg.toKey).then(function () {
        return {};
      }).fail(function (err) {
        throw new error.UpdateFailure({key: msg.key});
      });
    },
    copy : function (msg) {
      var self = this;
      return self.get({ key : msg.key}).then(function (res) {
        // if its a directory.
        if (res.type === 'collection') {
          // First create the directory then iteratively 
          // go down
          return self.set({
            key : msg.toKey,
            type : 'collection'
          }).then(function (result) {

            // Iterate over the directory content to fire promises.
            var promise = q(true);
            res.value.forEach(function (e) {
              var source = msg.key + '/' + e.key;
              var destination = msg.toKey + '/' + e.key;
              promise = promise.then(function () {
                return self.copy({key : source, toKey : destination});
              });
            });
            return promise;
          }).fail(function (err) {
            throw new error.UpsertFailure({key: msg.key});
          });
          
        } else {
          return self.set({key : msg.toKey, value : res.value}).then(function (result) {
            return {};
          }).fail(function () {
            throw new error.UpsertFailure({key: msg.key});
          });
        }
      });

    },
    delete : function (msg) {
      return ftp.delete(msg.key).then(function () {
        return {};
      })
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


