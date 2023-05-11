const fetch = require('node-fetch')

describe('middleware ends request', () => {
  it('does not call route if middleware ends request', async () => {
    const res = await fetch('http://127.0.0.1:11420/middleware/secrets/denied')
    expect(res.status).toEqual(401)
    expect(res.headers.get('route-was-hit')).toEqual(null)
  })
  it('calls route if param is present', async () => {
    const res = await fetch('http://127.0.0.1:11420/middleware/secrets/denied?isAuthorized=true')
    expect(res.status).toEqual(200)
    expect(res.headers.get('route-was-hit')).toEqual('true')
  })
})
