'use strict';

const url = require('url');
const http = require('http');
const https = require('https');
const net = require('net');
const assert = require('assert');

function createTunnelSocket(options, callback) {
  let proxy;
  
  try {
    proxy = url.parse(options.proxy);
  } catch (error) {
    return callback(error);
  }

  let connectOptions = {
    method: 'CONNECT',
    path: options.host + ':' + options.port,
    agent: false,
    host: proxy.hostname,
    port: proxy.port,
    headers: {
      host: options.host + ':' + options.port
    }
  };

  if (proxy.auth) {
    connectOptions.headers['Proxy-Authorization'] = 'Basic ' +
      Buffer.from(proxy.auth).toString('base64');
  }

  let request = (proxy.protocol  === 'https:') ? https.request : http.request;
  let connectReq = request(connectOptions);
  connectReq.useChunkedEncodingByDefault = false; // for v0.6
  connectReq.once('response', onResponse); // for v0.6
  connectReq.once('upgrade', onUpgrade);   // for v0.6
  connectReq.once('connect', onConnect);   // for v0.7 or later
  connectReq.once('error', onError);
  connectReq.end();

  function onResponse(res) {
    // Very hacky. This is necessary to avoid http-parser leaks.
    res.upgrade = true;
  }

  function onUpgrade(res, socket, head) {
    // Hacky.
    process.nextTick(function() {
      onConnect(res, socket, head);
    });
  }

  function onConnect(res, socket, head) {
    connectReq.removeAllListeners();
    socket.removeAllListeners();

    if (res.statusCode === 200) {
      assert.equal(head.length, 0);
      callback(undefined, socket);
    } else {
      let error = new Error('tunneling socket could not be established, ' + 'statusCode=' + res.statusCode);
      error.code = 'ECONNRESET';
      callback(error);
    }
  }

  function onError(cause) {
    connectReq.removeAllListeners();
    let error = new Error('tunneling socket could not be established, ' + 'cause=' + cause.message);
    error.code = 'ECONNRESET';
    callback(error);
  }
}

module.exports = {
  createTunnelSocket
};
