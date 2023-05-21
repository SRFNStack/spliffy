const fetch = require('node-fetch')

describe('route middleware', () => {
  it('applies route middleware', async () => {
    const res = await fetch('http://localhost:11420/middleware/secrets/mine')
    expect(res.status).toEqual(200)
    expect(res.headers.get('app-mw-applied')).toEqual('true')
    expect(res.headers.get('middleware-was-here')).toEqual('true')
    expect(res.headers.get('route-mw-applied')).toEqual('true')
  })
})
