import { div, h3, p, code, ul, li, strong, a } from './fnelements.mjs'
import prismCode from './prismCode.js'

export default div(
  h3('WebSockets'),
  p(
    'Sometimes a request/response just isn\'t enough to keep the session going. Spliffy supports WebSockets out of the box so you can keep the connection lit.'
  ),
  p(
    'To handle WebSockets, export a ', code('WEBSOCKET'), ' object from your route file.'
  ),
  prismCode(`
export default {
    WEBSOCKET: {
        open: (ws) => {
            console.log('A new friend joined the circle')
            ws.send('Welcome to the session')
        },
        message: (ws, message, isBinary) => {
            console.log('Message received:', message)
            ws.send('I hear you, man')
        },
        drain: (ws) => {
            console.log('Backpressure is gone, keep it flowing')
        },
        close: (ws, code, message) => {
            console.log('Friend left the circle')
        }
    }
}
`),
  h3('The WebSocket Object'),
  p('The ', code('ws'), ' object passed to the handlers is a µWebSockets.js WebSocket instance. It has several useful methods:'),
  ul(
    li(strong('send(message, isBinary)'), ': Send a message to the client. Returns 1 for success, 0 for dropped due to backpressure, or 2 for dropped due to high backpressure.'),
    li(strong('getUserData()'), ': Get the user data associated with this connection.'),
    li(strong('subscribe(topic)'), ': Subscribe to a topic (Pub/Sub).'),
    li(strong('unsubscribe(topic)'), ': Unsubscribe from a topic.'),
    li(strong('publish(topic, message, isBinary)'), ': Publish a message to a topic.'),
    li(strong('close()'), ': Gracefully close the connection.'),
    li(strong('end()'), ': Forcefully close the connection.')
  ),
  p('Check out the ', a({ href: 'https://github.com/uNetworking/uWebSockets.js/blob/master/examples/WebSocket.js' }, 'µWebSockets.js documentation'), ' for more advanced usage.')
)
