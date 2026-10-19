// the uwebsockets entry of https://github.com/the-benchmarker/web-frameworks, what spliffy is measured against
import { App } from 'uWebSockets.js'

const app = App()
app.get('/', (res) => { res.end('') })
app.get('/user/:id', (res, req) => { res.end(req.getParameter(0)) })
app.post('/user', (res) => { res.end('') })
app.listen(3000, () => {})
