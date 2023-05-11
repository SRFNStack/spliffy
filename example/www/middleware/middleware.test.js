const fetch = require('node-fetch')

describe('middleware files', () => {
  it('applies middleware to routes at the same level', async () => {
    const res = await fetch('http://127.0.0.1:11420/middleware')
    expect(res.headers.get('middleware-was-here')).toEqual('true')
    expect(res.headers.get('app-mw-applied')).toEqual('true')
  })
  it('applies middleware to routes in sub folders', async () => {
    const res = await fetch('http://127.0.0.1:11420/middleware/stuff')
    expect(res.headers.get('middleware-was-here')).toEqual('true')
    const res2 = await fetch('http://127.0.0.1:11420/middleware/stuff/errors/oops')
    expect(res2.headers.get('middleware-was-here')).toEqual('true')
  })
})
