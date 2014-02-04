var Q = require('q');
var Stream = require('stream');
var error = require('../error');
var AWS = require('aws-sdk');

// for initial testing s3config has the amazon credentials
// (the credentials will be moved out of the repo)
AWS.config.loadFromPath(__dirname + '/s3config.json');

var _s3 = new AWS.S3();
var s3 = {
  createBucket: Q.nbind(_s3.createBucket, _s3),
  deleteObject: Q.nbind(_s3.deleteObject, _s3),
  headBucket: Q.nbind(_s3.headBucket, _s3),
  headObject: Q.nbind(_s3.headObject, _s3),
  listObjects: Q.nbind(_s3.listObjects, _s3),
  putObject: Q.nbind(_s3.putObject, _s3)
};

var s3Driver = function (next) {

  // TBD need to talk about top level bucket names
  // Also about streaming - note the section on streaming with node aws sdk here:
  //   http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-making-requests.html#Streaming_Requests

  var ops = {
    get: function (msg) {
      //console.log('GET:', msg);

      // the amazon api doesn't indicate if the key is a non-existent file, so
      // we start by explicitly checking if the file exists:
      return s3.headObject({
        Bucket: 'cwohub-dev',
        Key: msg.key,
      }).then(function (data) {
        //console.log('found the file:', msg.key);
        // the amazon api synchronously returns a stream - convert it to a promise:
        var fileStream = _s3.getObject({
          Bucket: 'cwohub-dev',
          Key: msg.key,
        }).createReadStream();
        if(fileStream) {
          // TBD will later add "mediaType" below
          return Q({
            key: msg.key,
            value: fileStream
          }); 
        }
        else {
          // this should never happen (head already found the file) - but jic:
          return Q.reject(error.NotFound({key: msg.key}));
        }
      }).fail(function (err) {
        if(err.statusCode === 404) {
          // failed to find a file at this key - maybe this is a folder:
          var params = {
            Bucket: 'cwohub-dev',
            Delimiter: "/"
          };
          if (msg.key && msg.key !== '/') {
            params.Prefix = msg.key + '/';
          }
          // We have to convert the s3 output into what looks like files/directories
          var contents = [];
          //console.log('LISTING OBJECTS:', params);
          return s3.listObjects(params).then(function (data) {
            //console.log("\nObjects in " + (params.Prefix ? params.Prefix : "top") + " directory:");
            //console.log(data);
            if (data.CommonPrefixes && data.CommonPrefixes.length > 0) {
              //console.log("Directories:");
              data.CommonPrefixes.forEach(function (prefix) {
                //console.log("  " + normalize(prefix.Prefix, params.Prefix));
                contents.push({key: normalize(prefix.Prefix, params.Prefix), type: 'collection'});
              });
            }
            if (data.Contents) {
              //console.log("Files:");
              data.Contents.forEach(function (file) {
                if (file.Key !== params.Prefix) {
                  //console.log("  " + normalize(file.Key, params.Prefix));
                  contents.push({key: normalize(file.Key, params.Prefix)});
                }
              });
            }
  //console.log('CONTENTS:', contents.toString());
            return {
              key: msg.key,
              value: contents
            };
          }).fail(function (listerr) {
            // It was neither an object or a folder
  //console.log('FAILED TO LIST OBJECTS!');
            return Q.reject(error.NotFound({key: msg.key}));
          });
        } else {
          // got a non-404 error trying to GET the key:
          // (AM I SUPPOSED TO TRANSLATE HERE TO A KEYDB CODE?)
          return Q.reject(err.code); 
        }       
      });
    },
    set: function (msg) {
      if (msg.type !== 'collection') {
        // create a file
        var promise;
        promise = s3.putObject({
          Bucket: 'cwohub-dev',
          Key: msg.key,
          Body: msg.value
        });
      }
      else {
        // create a collection
        // but nothing to do if it's already there:
        promise = s3.headBucket({Bucket: msg.key}).fail(function (err) {
          // wasn't there: (do I need to translate the result)
          return s3.createBucket({Bucket: msg.key}).then(function (result) {
            // the promise just resolves with no value on success:
            return undefined;
          });
        });
      }
      return promise;
    },
    delete: function (msg) {
      return s3.deleteObject({
        Bucket: 'cwohub-dev',
        Key: msg.key
      });
    },
    meta: function (msg) {
      console.log('META:', msg);

      // an s3 "object" is is a file:
 /*     return s3.headObject({
          Bucket: 'cwohub-dev',
          Key: msg.key
      }).then(function (data) {
        console.log(msg.key + ' was an object');
        return {
          key: msg.key
        };
      }).fail(function (err) { */
        // an s3 "bucket" is a folder:
        return s3.headBucket({
          Bucket: 'cwohub-dev'
        }).then(function (data) {
        return {
          key: msg.key,
          type: 'collection'
        };
      }).fail(function (err) {
        // it was neither a file or a folder:
        throw error.NotFound({key: msg.key});
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

module.exports = s3Driver;
