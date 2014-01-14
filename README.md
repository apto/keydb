keydb
=====

[![Build Status](https://secure.travis-ci.org/apto/keydb.png)](http://travis-ci.org/apto/keydb)

Key/value data/query API to use on the server or in the browser.

## Installation

### npm

npm install keydb

## Usage

By default, KeyDB is a middleware stack that does nothing. At a minimum, you
must provide it with a data source. A data source is just a function that
returns data.

```js
var keydb = require('keydb');

var db = keydb();

db.source(function (msg) {
  return msg;
});

console.log(db("Hello, World!"));
```

The above database will simply echo the message sent to it. That's not very
useful. To do something more useful, use the included drivers.

```js
var keydb = require('keydb');

var db = keydb();

db.driver(keydb.drivers.upsert);
db.driver(keydb.drivers.mysql, {
  database: 'test',
    tables: {
      user: {
        properties: {
          user_id: {
            type: 'string',
            maxLength: 100
          },
          first_name: {
            type: 'string',
            maxLength: 100
          },
          last_name: {
            type: 'string',
            maxLength: 100
          }
        },
        primaryKey: 'user_id'
      }
    }
});

db({
    op: 'upsert',
    attributes: {
      user_id: 'joe', first_name: 'Joe', last_name: 'Foo'
    },
    filters: {user_id: 'joe'}
  })
  .then(function () {
    return db({op: 'query', filters: {user_id: 'joe'}});
  })
  .then(function (msg) {
    console.log(msg.items);
  })
```

In the above example, an upsert driver is stacked on top of a mysql driver so
that upsert semantics can be added to mysql without the underlying driver
actually supporting upsert.

Some drivers are preconfigured stacks, and these can be easily created by their
IDs. They may also add sugar methods.

```js
var keydb = require('keydb');

var db = keydb('kv-mysql');

db.set('users/joe', {firstName: 'Joe'})
  .then(function () {
    return db.get('users/joe');
  })
```

The above is the same as:

```js
var keydb = require('keydb');

var db = keydb('kv-mysql');

db({op: 'set', key: 'users/joe', value: {firstName: 'Joe'}})
  .then(function () {
    return db({op: 'get', key: 'users/joe'});
  })
```