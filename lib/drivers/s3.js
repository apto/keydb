var Q = require('q');
var Stream = require('stream');
var error = require('../error');
var AWS = require('aws-sdk');

var s3Driver = function (next, options) {

console.log(options.fred);
  options = options || {};

  AWS.config.update({
    accessKeyId: options.accessKeyId || process.env.KEYDB_DRIVERS_S3_ACCESSKEYID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: options.secretAccessKey || process.env.KEYDB_DRIVERS_S3_SECRETACCESSKEY || process.env.AWS_SECRET_ACCESS_KEY,
    region: options.region || process.env.KEYDB_DRIVERS_S3_REGION || process.env.AWS_REGION
  });

  var _s3 = new AWS.S3();
  var s3 = {
    createBucket: Q.nbind(_s3.createBucket, _s3),
    deleteObject: Q.nbind(_s3.deleteObject, _s3),
    headBucket: Q.nbind(_s3.headBucket, _s3),
    headObject: Q.nbind(_s3.headObject, _s3),
    listObjects: Q.nbind(_s3.listObjects, _s3),
    putObject: Q.nbind(_s3.putObject, _s3)
  };

  var ops = {
    get: function (msg) {
      //console.log('GET:', msg);

      // the amazon api doesn't indicate if the key is a non-existent file, so
      // we start by explicitly checking if the file exists:
      return s3.headObject({
        Bucket: 'cwohub-dev',
        Key: msg.key,
      }).then(function (data) {
        // the amazon api synchronously returns a stream - convert it to a promise:
        var fileStream = _s3.getObject({
          Bucket: 'cwohub-dev',
          Key: msg.key,
        }).createReadStream();
        if(fileStream) {
          // TBD will later add "mediaType" below
          return {
            key: msg.key,
            value: fileStream
          }; 
        }
        else {
          // this should never happen (head already found the file) - but JIC:
          throw new error.NotFound({key: msg.key});
        }
      },function (err) {
        if(err.statusCode === 404) {
          // failed to find a file at this key - maybe this is a folder:
          return folderContents(msg.key, true).then(function (results) {
            // folders created through our set or aws console have at
            // least a zero byte placeholder, otherwise this is a bad key
            if(results.value && results.value.length > 0) {
              return results;
            }
            else {
              throw new error.NotFound({key: msg.key});
            }
          });
        } else {
          // got a non-404 error trying to GET the key:
          throw new error.ReadFailure({key: msg.key});
        }       
      });
    },
    set: function (msg) {
      // the below was tested and worked when msg.value was from fs.createReadString(). See:
      //   http://stackoverflow.com/questions/19016130/pushing-binary-data-to-amazon-s3-using-node-js
      if (msg.type !== 'collection') {
        // create a file
        return s3.putObject({
          Bucket: 'cwohub-dev',
          Key: msg.key,
          Body: msg.value
        });
      }
      else {
        // create a collection
        // s3 doesn't have directories, only top level buckets with keys
        // we mimic what aws console does, which is create a zero byte file 
        // within a key that looks like a path to a directory 
        return s3.putObject({
          Bucket: 'cwohub-dev',
          Key: msg.key + '/'
        });
      }
    },
    delete: function (msg) {
      // the sdk was silently failing if we tried to delete a non-existent file -
      // so first see if it's a file or not:
      return s3.headObject({
          Bucket: 'cwohub-dev',
          Key: msg.key
      }).then(function (data) {
        // it is a file object: delete with the key as given
        return s3.deleteObject({
          Bucket: 'cwohub-dev',
          Key: msg.key 
        });
      }, function (err) {
        // not a file object: the key is a directory (or an invalid key)
        return s3.deleteObject({
          Bucket: 'cwohub-dev',
          Key: msg.key + '/'
        });
      });
    },
    meta: function (msg) {
      console.log('META:', msg);

      // an s3 "object" is a file:
      return s3.headObject({
          Bucket: 'cwohub-dev',
          Key: msg.key
      }).then(function (data) {
        return {
          key: msg.key
        };
      }, 
      function (err) {
        // not a file object: the key is a directory (or an invalid key)
        return folderContents(msg.key, true).then(function(results) {
          if(results.value && results.value.length > 0) {
            return {
              key: msg.key,
              type: 'collection'
            };
          }
          else {
            // There was nothing with the specified key as it's prefix:
            throw new error.NotFound({key: msg.key});          
          }
        },
        function (err) {
          // folderContents failed (invalid key?)
          throw new error.NotFound({key: msg.key});
        });
      });
    }
  };

  /**
  * Return a promise for the contents of a folder as an array of json objects
  * @param key the path to the folder beneath the s3 bucket
  * @param includeFolder include the zero byte folder "placeholder"?  (defaults to false)
  * @returns a promise for an object of the form { key: key, value: contents }
  */
  function folderContents(key, includeFolder) {
    var params = {
      Bucket: 'cwohub-dev',
      Delimiter: "/"
    };
    if (key && key !== '/') {
      params.Prefix = key + '/';
    }
    // We have to convert the s3 output into what looks like files/directories
    var contents = [];
    return s3.listObjects(params).then(function (data) {
      //console.log("\nObjects in " + (params.Prefix ? params.Prefix : "top") + " directory:");
      //console.log(data);
      if (data.CommonPrefixes && data.CommonPrefixes.length > 0) {
        data.CommonPrefixes.forEach(function (prefix) {
          contents.push({key: normalize(prefix.Prefix, params.Prefix), type: 'collection'});
        });
      }
      if (data.Contents) {
        data.Contents.forEach(function (file) {
          if (includeFolder || file.Key !== params.Prefix) {
            contents.push({key: normalize(file.Key, params.Prefix)});
          }
        });
      }
      return {
        key: key,
        value: contents
      };
    },
    function (listerr) {
      // Nothing to list with the specified key
      throw new error.NotFound({key: key});
    });
  }

  // Remove the specified prefix from the start of the object key
  // Remove trailing '/' if there is one.
  function normalize(objectKey, prefix) {
    var normalized = objectKey;
    if (prefix && objectKey.indexOf(prefix) === 0) {
      normalized = normalized.substring(prefix.length);
    }
    if (normalized[normalized.length - 1] === '/') {
      normalized = normalized.substring(0, normalized.length - 1);
    }
    return normalized;
  }

  var source = function (msg) {
    if (ops[msg.op]) {
      return ops[msg.op](msg);
    } else {
      return next(msg);
    }
  };
  return source;
};

module.exports = s3Driver;
