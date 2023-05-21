const fetch = require('node-fetch')

describe('middleware error', () => {
  it('should pass errors thrown by middleware to error middleware', async () => {
    const res = await fetch('http://localhost:11420/middleware/stuff/errors/mad')
    expect(res.headers.get('error-mw-applied')).toEqual('true')
    expect(res.headers.get('app-mw-applied')).toEqual('true')
    expect(res.headers.get('middleware-was-here')).toEqual('true')
    expect(res.headers.get('broke-mw-applied')).toEqual('true')
    expect(res.status).toEqual(200)
  })
})
