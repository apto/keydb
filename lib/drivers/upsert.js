var _ = require('underscore');
var error = require('../error');

// convert upsert to create/update
var createUpsertSource = function (next) {
  var source = function (msg) {
    if (msg.op === 'set') {
      var createMsg = _.extend({}, msg);
      var updateMsg = _.extend({}, msg);
      createMsg.op = 'create';
      updateMsg.op = 'update';
      // try an update first
      return next(updateMsg)
        .fail(function (error1) {
          // maybe that failed because it doesn't exist, so try a create
          return next(createMsg)
            .fail(function (error2) {
              // maybe someone else already created, so try another update
              return next(updateMsg)
                .fail(function (error3) {
                  throw new error.UpsertFailure({key: msg.key, errors: [error1, error2, error3]});
                });
            });
        });
    } else {
      return next(msg);
    }
  };

  return source;
};

module.exports = createUpsertSource;