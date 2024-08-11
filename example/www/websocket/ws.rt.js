import ws from 'ws'

const allSockets = []

setInterval(()=>{
  for(const ws of allSockets) {
    ws.send(new Date().toISOString())
  }
}, 3000)

export default {
  WEBSOCKET: {
    open: (ws) => {
      allSockets.push(ws)
    },
    close: (ws) => {
      const index = allSockets.indexOf(ws)
      if (index !== -1) {
        allSockets.splice(index, 1)
      }
    }
  }
}