keydb
=====

[![Build Status](https://secure.travis-ci.org/apto/keydb.png)](http://travis-ci.org/apto/keydb)

KeyDB is generic middleware for data.

KeyDB provides the tools to create *somewhat* consistent read/write APIs to
heterogenous data sources. The key word here is *somewhat*. KeyDB does not
attempt to completely paper over the semantic differences of all possible data
sources. Instead, it uses the middleware concept to have low level "sources"
that speak the native semantics of a physical data source and higher level
"drivers" that massage those semantics into more consistent APIs.

The "key" in KeyDB refers to the desire to use key/value semantics as much as
possible for reasons of performance, simplicity, and because it's usually a
common denominator across data sources.

An original goal of KeyDB was to provide consistent data APIs across client and
server. For example, local storage and MySQL. Currently, the focus is on server
APIs, but hopefully the original intent will be revisited in the future.

## Installation

### npm

npm install keydb

## Usage

By default, KeyDB is a middleware stack that does almost nothing. At a minimum,
you must provide it with a data source. A data source is just a function that
returns data.

```js
var keydb = require('keydb');

var db = keydb();

db.source(function (msg) {
  return msg;
});

db("Hello, World!").then(function (msg) {
  console.log(msg);
});
```

The above database will simply echo the message sent to it. Note that KeyDB
does automatically wrap synchronous data sources in a promise API. This is the
default behavior because it is possible to make synchronouse APIs asynchronous,
but it is impossible to make asynchronous APIs synchronous. Some drivers take
a synchronous option, including the default stack driver. For example:

```js
var keydb = require('keydb');

var db = keydb({sync: true});

db.source(function (msg) {
  return msg;
});

console.log(db("Hello, world"));
```

Of course, the above data sources aren't very useful. To do something more
useful, use the included drivers.

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
actually supporting upsert. (Of course, MySQL does directly provide some
upsert capabilities. Just pretend it doesn't.) This demonstrates the philosophy
and use of middleware in KeyDB. Each source and driver does only what it needs
to do. Other features are added by stacking drivers together, rather than
making monolithic data sources or drivers.

Some drivers are preconfigured stacks, and these can be easily created by their
names. They may also add sugar methods.

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