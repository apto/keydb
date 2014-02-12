var _ = require('underscore');
var error = require('../error');

var getNode = function (root, key) {
  if (key === '' || !key) {
    return root;
  }
  var keys = key.split('/');
  var node = root.nodes ? root.nodes[keys[0]] : null;
  if (node && keys.length > 1) {
    return getNode(node, keys.slice(1).join('/'));
  }
  return node;
};

var copyNode = function (fromNode, parentNode, key) {
  var newNode = {};
  if (fromNode.type) {
    newNode.type = fromNode.type;
  }
  newNode.mediaType = fromNode.mediaType;
  parentNode.nodes[key] = newNode;
  if (fromNode.type === 'collection') {
    newNode.nodes = {};
    Object.keys(fromNode.nodes).forEach(function (fromKey) {
      copyNode(fromNode.nodes[fromKey], newNode, fromKey);
    });
  } else {
    // will not mutate buffer, so no need to copy
    newNode.value = fromNode.value;
  }
};

var nodeValue = {
  collection: function (node, prefix) {
    return Object.keys(node.nodes).map(function (key) {
      var childNode = node.nodes[key];
      var childRef = {
        key: prefix + key
      };
      if (childNode.type) {
        childRef.type = childNode.type;
      }
      return childRef;
    });
  },
  value: function (node) {
    return node.value;
  }
};

var createMemorySource = function (next, obj) {
  var root = {
    type: 'collection',
    nodes: {}
  };

  var getLocation = function (key) {
    var parentNode = null;
    var node = null;
    var nodeKey;
    if (key === '') {
      node = root;
    } else {
      var keys = key.split('/');
      if (keys.length === 1) {
        parentNode = root;
        node = getNode(parentNode, key);
        nodeKey = key;
      } else {
        var parentKey = keys.slice(0, keys.length - 1).join('/');
        parentNode = getNode(root, parentKey);
        nodeKey = keys[keys.length - 1];
        if (parentNode) {
          node = getNode(parentNode, nodeKey);
        }
      }
    }
    return {
      parent: parentNode,
      node: node,
      key: nodeKey
    };
  };

  var getMeta = function (msg) {
    var node = getNode(root, msg.key);
    if (!node) {
      throw new error.NotFound({key: msg.key});
    }
    var metaMsg = {
      key: msg.key
    };
    if (node.type) {
      metaMsg.type = node.type;
    }
    if (node.value) {
      metaMsg.size = node.value.length;
    }
    return {
      node: node,
      msg: metaMsg
    };
  };

  var ops = {
    get: function (msg) {
      var result = getMeta(msg);
      var node = result.node;
      var prefix = msg.key === '' ? '' : msg.key + '/';
      result.msg.value = nodeValue[node.type || 'value'](node, prefix);
      if (node.mediaType) {
        result.msg.mediaType = node.mediaType;
      }
      return result.msg;
    },
    set: function (msg) {
      var loc = getLocation(msg.key);
      var parentNode = loc.parent;
      var node = loc.node;
      var nodeKey = loc.key;
      if (!parentNode && node) {
        if (msg.type === 'collection') {
          node.nodes = {};
          return;
        }
      } else if (parentNode && parentNode.nodes) {
        if (msg.op === 'delete') {
          delete parentNode.nodes[nodeKey];
          return;
        }
        var newNode = {};
        if (msg.type) {
          newNode.type = msg.type;
        }
        if (msg.type !== 'collection') {
          newNode.value = new Buffer(msg.value);
          newNode.mediaType = msg.mediaType || 'application/octet-stream';
        } else {
          newNode.nodes = {};
        }
        parentNode.nodes[nodeKey] = newNode;
        return;
      }
      throw new error.NotFound({key: msg.key});
    },
    meta: function (msg) {
      var result = getMeta(msg);
      return result.msg;
    },
    delete: function (msg) {
      return ops.set(msg);
    },
    copy: function (msg) {
      var fromMeta = getMeta(msg);
      var fromNode = fromMeta.node;
      var loc = getLocation(msg.toKey);
      if (loc.parent) {
        if (loc.node) {
          ops.set({op: 'delete', key: msg.toKey});
        }
        copyNode(fromNode, loc.parent, loc.key);
        return;
      }
      throw new error.NotFound({key: msg.key});
    },
    move: function (msg) {
      ops.copy(msg);
      ops.set({op: 'delete', key: msg.key});
    }
  };

  var normalize = function (originalMsg) {
    var msg = _.extend({}, originalMsg);
    if (msg.key.length > 0 && msg.key[0] === '/') {
      msg.key = msg.key.substring(1);
    }
    return msg;
  };

  var source = function (msg) {
    return ops[msg.op](normalize(msg));
  };

  return source;
};

module.exports = createMemorySource;