keydb
=====

[![Build Status](https://secure.travis-ci.org/apto/keydb.png)](http://travis-ci.org/apto/keydb)

Key/value data/query API to use on the server or in the browser.

## Installation

### npm

npm install keydb

## Usage

Writes through KeyDB are done with the `send` method, and reads are done with
the `query` method.

```js
var keydb = require('keydb');

// mysql driver assumes localhost/3306/root
var db = keydb('mysql', 'test');

// upsert
db.send({op: 'set', key: 'foo', value: 'bar'})
  .then(function () {
    // foo is now "bar"
  })
  .then(function () {
    // use funql syntax to query
    return db.query("eq(key,'foo')");
  })
  .then(function (items) {
    // items[0].key === "foo"
    // items[0].value === "bar"
  })
  .finally(function () {
    // disconnect
    return db.end();
  });
```

You can use `set` sugar instead of the `send` method for a set operation, and
you can use `get` sugar to retrieve a single key:

```js
var keydb = require('keydb');

// mysql driver assumes localhost/3306/root
var db = keydb('mysql', 'test');

// upsert
db.set('foo', 'bar')
  .then(function () {
    // foo is now "bar"
  })
  .then(function () {
    return db.get('foo')
  })
  .then(function (item) {
    // item.key === "foo"
    // item.value === "bar"
  })
  .finally(function () {
    // disconnect
    return db.end();
  });
```