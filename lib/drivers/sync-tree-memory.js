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

  var meta = function (msg) {
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
    return {
      node: node,
      msg: metaMsg
    };
  };

  var ops = {
    get: function (msg) {
      var result = meta(msg);
      var node = result.node;
      var prefix = msg.key === '' ? '' : msg.key + '/';
      result.msg.value = nodeValue[node.type || 'value'](node, prefix);
      if (node.mediaType) {
        result.msg.mediaType = node.mediaType;
      }
      return result.msg;
    },
    set: function (msg) {
      var parentNode = null;
      var node = null;
      var nodeKey;
      if (msg.key === '') {
        node = root;
      } else {
        var keys = msg.key.split('/');
        if (keys.length === 1) {
          parentNode = root;
          node = getNode(parentNode, msg.key);
          nodeKey = msg.key;
        } else {
          var parentKey = keys.slice(0, keys.length - 1).join('/');
          parentNode = getNode(root, parentKey);
          nodeKey = keys[keys.length - 1];
          if (parentNode) {
            node = getNode(parentNode, nodeKey);
          }
        }
      }
      if (!parentNode && node) {
        if (msg.type === 'collection') {
          node.nodes = {};
          return;
        }
      } else if (parentNode && parentNode.nodes) {
        var newNode = {};
        if (msg.type) {
          newNode.type = msg.type;
        }
        if (msg.type !== 'collection') {
          newNode.value = msg.value;
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
      var result = meta(msg);
      return result.msg;
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