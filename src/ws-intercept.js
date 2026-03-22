(function(){
  var _WS = window.WebSocket;
  window.__ttydWS = null;
  window.WebSocket = function(url, protocols) {
    var ws = protocols ? new _WS(url, protocols) : new _WS(url);
    window.__ttydWS = ws;
    window.WebSocket = _WS;
    return ws;
  };
  window.WebSocket.prototype = _WS.prototype;
  window.WebSocket.CONNECTING = _WS.CONNECTING;
  window.WebSocket.OPEN = _WS.OPEN;
  window.WebSocket.CLOSING = _WS.CLOSING;
  window.WebSocket.CLOSED = _WS.CLOSED;
  document.fonts.load("15px 'JetBrains Mono NF'");
})();