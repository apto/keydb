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
db.driver(keydb.drivers.version);
db.driver(keydb.drivers.mysql);

db({op: 'set', key: 'users/joe', value: {fn: 'Joe'}})
  .then(function () {
    return db({op: 'get', key: 'users/joe'});
  })
  .then(function (msg) {
    console.log(msg);
  })
```