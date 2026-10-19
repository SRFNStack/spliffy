const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')
const https = require('https')
const net = require('net')
const tls = require('tls')
const zlib = require('zlib')
// the same payload compressed/big.rt.mjs builds, jest cannot import the module
const items = []
for (let i = 0; i < 300; i++) items.push({ id: i, name: `item ${i}`, tags: ['a', 'b', 'c'], price: i * 7 })
const payload = { items, count: items.length }

const base = 'http://localhost:11421'
const tlsBase = 'https://localhost:11422'
// the test certificate is self signed
const agent = new https.Agent({ rejectUnauthorized: false })

// a bare websocket client: one masked text frame out, the first frame back, no library
const wsEcho = (socket, host, text) => new Promise((resolve, reject) => {
  const key = require('crypto').randomBytes(16).toString('base64')
  let buffered = Buffer.alloc(0)
  let upgraded = false
  socket.on('error', reject)
  socket.on('data', chunk => {
    buffered = Buffer.concat([buffered, chunk])
    if (!upgraded) {
      const end = buffered.indexOf('\r\n\r\n')
      if (end === -1) return
      const head = buffered.slice(0, end).toString()
      if (!/^HTTP\/1\.1 101/.test(head)) return reject(new Error(head))
      upgraded = true
      buffered = buffered.slice(end + 4)
      const payload = Buffer.from(text)
      const mask = require('crypto').randomBytes(4)
      const frame = Buffer.alloc(6 + payload.length)
      frame[0] = 0x81
      frame[1] = 0x80 | payload.length
      mask.copy(frame, 2)
      for (let i = 0; i < payload.length; i++) frame[6 + i] = payload[i] ^ mask[i & 3]
      socket.write(frame)
    }
    if (upgraded && buffered.length >= 2 && buffered.length >= 2 + (buffered[1] & 0x7f)) {
      const length = buffered[1] & 0x7f
      socket.end()
      resolve({ opcode: buffered[0] & 0x0f, text: buffered.slice(2, 2 + length).toString() })
    }
  })
  socket.write(`GET /sock HTTP/1.1\r\nHost: ${host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`)
})

describe('routes with no middleware', () => {
  it('returns an empty 200 for an empty handler', async () => {
    const res = await fetch(`${base}/`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
    const post = await fetch(`${base}/`, { method: 'POST' })
    expect(post.status).toBe(200)
    expect(await post.text()).toBe('')
  })

  it('serves path params and query', async () => {
    const res = await fetch(`${base}/user/42`)
    expect(await res.text()).toBe('42')
    const del = await fetch(`${base}/user/7?a=1&b=2`, { method: 'DELETE' })
    expect(await del.json()).toEqual({ id: '7', query: { a: '1', b: '2' } })
  })

  it('keeps the request readable after an async handler yields', async () => {
    const res = await fetch(`${base}/echo?x=y`)
    expect(await res.json()).toEqual({ host: 'localhost:11421', query: { x: 'y' }, path: '/echo', url: '/echo?x=y' })
  })

  it('deserializes the request body', async () => {
    const res = await fetch(`${base}/echo`, { method: 'POST', body: JSON.stringify({ hi: 'there' }), headers: { 'content-type': 'application/json' } })
    expect(await res.json()).toEqual({ received: { hi: 'there' }, contentType: 'application/json' })
    const text = await fetch(`${base}/echo`, { method: 'POST', body: 'plain words', headers: { 'content-type': 'text/plain' } })
    expect(await text.json()).toEqual({ received: 'plain words', contentType: 'text/plain' })
    const big = await fetch(`${base}/echo`, { method: 'PUT', body: Buffer.alloc(300_000, 1) })
    expect(await big.json()).toEqual({ isBuffer: true, length: 300_000 })
  })

  it('resolves an empty buffer when there is no body', async () => {
    const res = await fetch(`${base}/echo`, { method: 'PUT' })
    expect(await res.json()).toEqual({ isBuffer: true, length: 0 })
    const json = await fetch(`${base}/echo`, { method: 'POST', headers: { 'content-type': 'application/json' } })
    expect(json.status).toBe(200)
    expect(await json.json()).toEqual({ received: { type: 'Buffer', data: [] }, contentType: 'application/json' })
  })

  it('maps thrown errors to their status', async () => {
    const res = await fetch(`${base}/throws`)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ errors: ['nope'] })
    const post = await fetch(`${base}/throws`, { method: 'POST' })
    expect(post.status).toBe(400)
    expect(await post.json()).toEqual({ errors: ['async nope'] })
  })

  it('writes headers, status and status message', async () => {
    const res = await fetch(`${base}/headers`)
    expect(res.status).toBe(201)
    expect(res.headers.get('x-bare')).toBe('yes')
    expect(await res.text()).toBe('created')
    const post = await fetch(`${base}/headers`, { method: 'POST' })
    expect(post.status).toBe(202)
    expect(post.statusText).toBe('Whatever')
    expect(post.headers.get('x-bare')).toBe('also')
    expect(post.headers.get('content-type')).toBe('application/json')
    expect(await post.json()).toEqual({ ok: true })
    const put = await fetch(`${base}/headers`, { method: 'PUT' })
    expect(put.status).toBe(203)
    expect(put.statusText).toBe('Non-Authoritative Information')
    expect(put.headers.get('x-bare')).toBe('desc')
    expect(put.headers.get('x-multi')).toBe('1, 2')
    expect(await put.text()).toBe('text body')
    const del = await fetch(`${base}/headers`, { method: 'DELETE' })
    expect(del.status).toBe(200)
    expect(del.headers.get('x-bare')).toBe('nobody')
    expect(await del.text()).toBe('')
  })

  it('supports res.send and res.redirect', async () => {
    const res = await fetch(`${base}/send`)
    expect(await res.json()).toEqual({ sent: true })
    const post = await fetch(`${base}/send`, { method: 'POST', redirect: 'manual' })
    expect(post.status).toBe(301)
    // node-fetch resolves the location header against the request url
    expect(post.headers.get('location')).toMatch(/\/elsewhere$/)
  })

  it('serves declarative responses', async () => {
    const res = await fetch(`${base}/decl/bob`)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-decl')).toBe('yes')
    expect(await res.text()).toBe('bob')
    const post = await fetch(`${base}/decl/bob`, { method: 'POST', body: 'ignored' })
    expect(post.status).toBe(202)
    expect(await post.text()).toBe('accepted')
  })

  it('serves cached static files as compiled responses', async () => {
    const res = await fetch(`${base}/static/hello.txt`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/plain')
    expect(res.headers.get('cache-control')).toBe('max-age=600')
    expect(res.headers.get('etag')).toMatch(/^".*"$/)
    expect(await res.text()).toBe('hello from a compiled static file\n')
    // a compiled response cannot compare etags, so a conditional request gets the file again
    const conditional = await fetch(`${base}/static/hello.txt`, { headers: { 'if-none-match': res.headers.get('etag') } })
    expect(conditional.status).toBe(200)
    expect(await conditional.text()).toBe('hello from a compiled static file\n')
  })

  it('serves static files bigger than one instruction', async () => {
    const expected = fs.readFileSync(path.join(__dirname, 'static', 'big.txt'), 'utf-8')
    expect(expected.length).toBeGreaterThan(65535)
    const res = await fetch(`${base}/static/big.txt`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(expected)
  })

  it('streams responses and request bodies', async () => {
    expect(await (await fetch(`${base}/streams`)).text()).toBe('hello from a compiled static file\n')
    expect(await (await fetch(`${base}/streams`, { method: 'POST' })).text()).toBe('abc')
    const put = await fetch(`${base}/streams`, { method: 'PUT' })
    expect(put.headers.get('content-type')).toBe('text/plain')
    expect(await put.text()).toBe('hello from a compiled static file\n')
    expect(await (await fetch(`${base}/streams`, { method: 'PATCH', body: 'streamed in' })).json()).toEqual({ got: 'streamed in' })
    expect(await (await fetch(`${base}/streams`, { method: 'DELETE' })).text()).toBe('late')
  })

  it('answers navigation requests for unknown paths with the default route', async () => {
    const shell = fs.readFileSync(path.join(__dirname, 'app.html'), 'utf-8')
    for (const p of ['/nothing/here', '/users/42', '/v1.2/things', '/.well-known/x', '/deep/path/']) {
      const res = await fetch(`${base}${p}`)
      expect([p, res.status]).toEqual([p, 200])
      expect(res.headers.get('content-type')).toMatch('text/html')
      expect(await res.text()).toBe(shell)
    }
  })

  it('falls through to the not found route for file-like, ignored and non-GET requests', async () => {
    for (const p of ['/missing.js', '/img/logo.png', '/api/users', '/api', '/internal/secret']) {
      const res = await fetch(`${base}${p}`)
      expect([p, res.status]).toEqual([p, 404])
      expect(res.headers.get('content-type')).toMatch('text/plain')
      expect(await res.text()).toBe('nope\n')
    }
    // the not found page is a static file, so it only has a GET handler and a POST gets a bare 404
    const post = await fetch(`${base}/nothing/here`, { method: 'POST' })
    expect(post.status).toBe(404)
    expect(await post.text()).toBe('')
  })

  it('finds node_modules files without nodeModulesPath by walking up from routeDir', async () => {
    const cookie = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'node_modules', 'cookie', 'dist', 'index.js'), 'utf-8')
    const res = await fetch(`${base}/lib/ext/cookie/dist/index.js`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(cookie)
    const etag = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'node_modules', 'etag', 'index.js'), 'utf-8')
    const aliased = await fetch(`${base}/lib/ext/etag.js`)
    expect(aliased.status).toBe(200)
    expect(await aliased.text()).toBe(etag)
  })

  it('serves the same routes over https', async () => {
    const res = await fetch(`${tlsBase}/user/42`, { agent })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('42')
    const post = await fetch(`${tlsBase}/echo`, { method: 'POST', body: '{"a":1}', headers: { 'content-type': 'application/json' }, agent })
    expect(await post.json()).toEqual({ received: { a: 1 }, contentType: 'application/json' })
    const missing = await fetch(`${tlsBase}/missing.js`, { agent })
    expect(missing.status).toBe(404)
    expect(await missing.text()).toBe('nope\n')
    const compiled = await fetch(`${tlsBase}/static/hello.txt`, { agent })
    expect(await compiled.text()).toBe('hello from a compiled static file\n')
    const spa = await fetch(`${tlsBase}/nothing/here`, { agent })
    expect(spa.status).toBe(200)
    // and http still answers too
    expect((await fetch(`${base}/user/42`)).status).toBe(200)
  })

  it('echoes over ws and wss', async () => {
    const plain = await wsEcho(net.connect(11421, 'localhost'), 'localhost:11421', 'over ws')
    expect(plain).toEqual({ opcode: 1, text: 'over ws' })
    const secure = await wsEcho(tls.connect({ port: 11422, host: 'localhost', rejectUnauthorized: false }), 'localhost:11422', 'over wss')
    expect(secure).toEqual({ opcode: 1, text: 'over wss' })
  })

  it('reads what a handler lists before the uws request dies', async () => {
    const post = await fetch(`${base}/shape?a=1&a=2&b=x`, { method: 'POST', body: '{"n":5}', headers: { 'content-type': 'application/json' } })
    expect(await post.json()).toEqual({ q: { a: ['1', '2'], b: 'x' }, body: { n: 5 } })
    const put = await fetch(`${base}/shape`, { method: 'PUT', body: 'hey', headers: { 'content-type': 'text/plain', 'x-tag': 'kept' } })
    expect(await put.json()).toEqual({ tag: 'kept', body: 'hey' })
  })

  it('echoes octet-stream bodies byte for byte', async () => {
    for (const size of [1, 1024, 10240, 102400]) {
      const body = require('crypto').randomBytes(size)
      const res = await fetch(`${base}/bin`, { method: 'POST', body, headers: { 'content-type': 'application/octet-stream' } })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('application/octet-stream')
      expect(Buffer.compare(await res.buffer(), body)).toBe(0)
    }
    const empty = await fetch(`${base}/bin`, { method: 'POST', headers: { 'content-type': 'application/octet-stream', 'content-length': '0' } })
    expect(empty.status).toBe(200)
    expect((await empty.buffer()).length).toBe(0)
    // an empty body is empty whatever content type it claims
    const emptyForm = await fetch(`${base}/bin`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': '0' } })
    expect(emptyForm.status).toBe(200)
    expect((await emptyForm.buffer()).length).toBe(0)
    // a body that happens to look like json stays bytes
    const digits = await fetch(`${base}/bin`, { method: 'POST', body: '123', headers: { 'content-type': 'application/octet-stream' } })
    expect(await digits.text()).toBe('123')
    expect(digits.headers.get('content-type')).toBe('application/octet-stream')
  })

  it('walks symlinked directories', async () => {
    const res = await fetch(`${base}/linked/linked.txt`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('served through a symlink\n')
  })

  it('serves precompressed variants and follows the disk', async () => {
    const dir = path.join(__dirname, 'assets')
    const css = fs.readFileSync(path.join(dir, 'site.css'))
    const plain = await fetch(`${base}/assets/site.css`, { compress: false })
    expect(plain.headers.get('content-type')).toBe('text/css')
    expect(plain.headers.get('content-encoding')).toBe(null)
    expect(plain.headers.get('vary')).toBe('accept-encoding')
    expect(Buffer.compare(await plain.buffer(), css)).toBe(0)

    const br = await fetch(`${base}/assets/site.css`, { compress: false, headers: { 'accept-encoding': 'br;q=1, gzip;q=0.8' } })
    expect(br.headers.get('content-encoding')).toBe('br')
    expect(br.headers.get('content-type')).toBe('text/css')
    expect(Buffer.compare(zlib.brotliDecompressSync(await br.buffer()), css)).toBe(0)

    const gz = await fetch(`${base}/assets/site.css`, { compress: false, headers: { 'accept-encoding': 'gzip, deflate' } })
    expect(gz.headers.get('content-encoding')).toBe('gzip')
    expect(Buffer.compare(zlib.gunzipSync(await gz.buffer()), css)).toBe(0)

    const none = await fetch(`${base}/assets/site.css`, { compress: false, headers: { 'accept-encoding': 'br;q=0, gzip;q=0' } })
    expect(none.headers.get('content-encoding')).toBe(null)

    // a file with no twins is sent as is, and the twins are not routes of their own
    const noTwin = await fetch(`${base}/assets/plain.css`, { compress: false, headers: { 'accept-encoding': 'br' } })
    expect(noTwin.headers.get('content-encoding')).toBe(null)
    expect(await noTwin.text()).toBe('.only { color: red }\n')
    expect((await fetch(`${base}/assets/site.css.br`)).status).toBe(404)

    // replace the file and its twins with different bytes of the same length: the next response has them
    const backup = {}
    for (const ext of ['', '.br', '.gz']) backup[ext] = fs.readFileSync(path.join(dir, 'site.css' + ext))
    try {
      const replaced = {}
      for (const ext of ['', '.br', '.gz']) {
        replaced[ext] = require('crypto').randomBytes(backup[ext].length)
        const tmp = path.join(dir, 'tmp' + ext)
        fs.writeFileSync(tmp, replaced[ext])
        fs.renameSync(tmp, path.join(dir, 'site.css' + ext))
      }
      const fresh = await fetch(`${base}/assets/site.css`, { compress: false })
      expect(Buffer.compare(await fresh.buffer(), replaced[''])).toBe(0)
      const freshBr = await fetch(`${base}/assets/site.css`, { compress: false, headers: { 'accept-encoding': 'br' } })
      expect(Buffer.compare(await freshBr.buffer(), replaced['.br'])).toBe(0)
    } finally {
      for (const ext of ['', '.br', '.gz']) fs.writeFileSync(path.join(dir, 'site.css' + ext), backup[ext])
    }
    const restored = await fetch(`${base}/assets/site.css`, { compress: false })
    expect(Buffer.compare(await restored.buffer(), css)).toBe(0)
  })

  it('compresses responses with the compression middleware', async () => {
    const text = JSON.stringify(payload)
    const none = await fetch(`${base}/compressed/big`, { compress: false })
    expect(none.headers.get('content-encoding')).toBe(null)
    expect(await none.text()).toBe(text)

    const br = await fetch(`${base}/compressed/big`, { compress: false, headers: { 'accept-encoding': 'gzip, br' } })
    expect(br.headers.get('content-encoding')).toBe('br')
    expect(br.headers.get('content-type')).toBe('application/json')
    expect(br.headers.get('vary')).toBe('accept-encoding')
    expect(zlib.brotliDecompressSync(await br.buffer()).toString()).toBe(text)

    const gz = await fetch(`${base}/compressed/big`, { compress: false, headers: { 'accept-encoding': 'gzip' } })
    expect(gz.headers.get('content-encoding')).toBe('gzip')
    expect(zlib.gunzipSync(await gz.buffer()).toString()).toBe(text)

    const tiny = await fetch(`${base}/compressed/big`, { method: 'POST', compress: false, headers: { 'accept-encoding': 'gzip, br' } })
    expect(tiny.headers.get('content-encoding')).toBe(null)
    expect(await tiny.text()).toBe('tiny')

    const streamed = await fetch(`${base}/compressed/big`, { method: 'PUT', compress: false, headers: { 'accept-encoding': 'gzip' } })
    expect(streamed.headers.get('content-encoding')).toBe('gzip')
    expect(zlib.gunzipSync(await streamed.buffer()).toString()).toBe(text)

    const binary = await fetch(`${base}/compressed/big`, { method: 'PATCH', compress: false, headers: { 'accept-encoding': 'gzip, br' } })
    expect(binary.headers.get('content-encoding')).toBe(null)
    expect((await binary.buffer()).length).toBe(4096)
  })
})
