// /sock: the WEBSOCKET behavior is registered on every listener, so it answers ws:// and wss:// alike
export default {
  WEBSOCKET: {
    message: (ws, message, isBinary) => {
      ws.send(message, isBinary)
    }
  }
}
