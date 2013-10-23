keydb
=====

Key/value data/query API to use on the server or in the browser.

## Installation

### npm

npm install keydb

## Usage

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