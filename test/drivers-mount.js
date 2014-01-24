var chai = require('chai');
var expect = chai.expect;
var keydb = require('keydb');

require('mocha-as-promised')();
chai.use(require('chai-as-promised'));

describe('mount driver test', function () {
  var db;

  var syncMemUsers = keydb('sync-memory');
  var syncMemBooks = keydb('sync-memory');
  it('should put users into users', function () {
    db = keydb('sync-mount-keys');
    db.mount('users/', syncMemUsers);
    db.mount('books/', syncMemBooks);

    db({op: 'set', key: 'users/joe', value: {firstName: 'Joe'}});
  });
  it('should get users from users', function () {
    var user = syncMemUsers({op: 'get', key: 'joe'});
    expect(user.value).to.eql({firstName: 'Joe'});
  });
  it('should put books into users', function () {
    db({op: 'set', key: 'books/dune', value: {author: 'Frank'}});
  });
  it('should get books from books', function () {
    var book = syncMemBooks({op: 'get', key: 'dune'});
    expect(book.value).to.eql({author: 'Frank'});
  });

  var asyncMemUsers = keydb('memory');
  var asyncMemBooks = keydb('memory');
  it('should put async users into users', function () {
    db = keydb('mount-keys');
    db.mount('users/', asyncMemUsers);
    db.mount('books/', asyncMemBooks);

    return db({op: 'set', key: 'users/joe', value: {firstName: 'Joe'}});
  });
  it('should get async users from users', function () {
    var userValue = asyncMemUsers({op: 'get', key: 'joe'})
      .then(function (msg) {
        return msg.value;
      });
    expect(userValue).to.eventually.eql({firstName: 'Joe'});
  });
  it('should put async books into users', function () {
    return db({op: 'set', key: 'books/dune', value: {author: 'Frank'}});
  });
  it('should get async books from books', function () {
    var bookValue = asyncMemBooks({op: 'get', key: 'dune'})
      .then(function (msg) {
        return msg.value;
      });
    expect(bookValue).to.eventually.eql({author: 'Frank'});
  });

  var kvMysql = keydb('kv-mysql', {
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
  it('should put user into mysql', function () {
    db = keydb('mount-keys');
    db.mount('users/', kvMysql, {msg: {table: 'user'}});
    return db({op: 'set', key: 'users/joe', value: {first_name: 'Joe', last_name: 'Foo'}});
  });
  it('should get user from mysql', function () {
    var userValue = db({op: 'get', key: 'users/joe'})
      .then(function (msg) {
        return msg.value;
      });
    return expect(userValue).to.eventually.eql({first_name: 'Joe', last_name: 'Foo'});
  });
});