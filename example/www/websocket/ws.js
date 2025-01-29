const ws = new WebSocket('/websocket/ws')
ws.onmessage = (event) => {
  const div = document.createElement('div')
  div.innerText = event.data
  document.body.append(div)
}
