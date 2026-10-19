const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')

const base = 'http://localhost:11421'

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
})
