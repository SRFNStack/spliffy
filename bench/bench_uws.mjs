import uws from 'uWebSockets.js'

uws.App().get('/', (res, req) => {
  res.writeStatus('200 OK')
    .writeHeader('Content-Type', 'application/json')
    .end(JSON.stringify({ hello: 'world' }))
}).listen(11421, (token) => {
  if (token) {
    console.log('uWS server listening on port 11421')
  }
})
