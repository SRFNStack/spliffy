const fetch = require('node-fetch')

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
})
