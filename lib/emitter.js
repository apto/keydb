var Emitter;

try {
  Emitter = require('emitter');
} catch (e) {
  Emitter = require('events').EventEmitter;
  Emitter.prototype.off = Emitter.prototype.off || function (event, listener) {
    if (listener) {
      Emitter.prototype.removeListener.call(this, event, listener);
    } else {
      Emitter.prototype.removeAllListeners.call(this, event);
    }
  };
}

module.exports = Emitter;