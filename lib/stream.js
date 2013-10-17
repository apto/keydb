var Stream;
var Readable;

Stream = require('stream');

if (Stream.Readable) {
  Readable = Stream.Readable;
} else {
  Readable = function Readable() {
    Stream.apply(this, arguments);
    this.readable = true;
    // TODO: buffer until read
    this.buffer = [];
    this.push = function (data) {
      if (data !== null) {
        this.emit('data', data);
      } else {
        this.emit('end');
      }
    };
  };
  Readable.prototype = Stream.prototype;
}

exports.Readable = Readable;