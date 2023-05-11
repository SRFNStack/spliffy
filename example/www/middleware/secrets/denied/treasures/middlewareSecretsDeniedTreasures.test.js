const fetch = require('node-fetch')

describe('parent middleware ends request', () => {
  it('does not call route if middleware ends request', async () => {
    const res = await fetch('http://127.0.0.1:11420/middleware/secrets/denied/treasures/mysecrets.txt')
    expect(res.status).toEqual(401)
    expect(res.headers.get('route-was-hit')).toEqual(null)
  })
  it('calls route if param is present', async () => {
    const res = await fetch('http://127.0.0.1:11420/middleware/secrets/denied/treasures/mysecrets.txt?isAuthorized=true')
    const body = await res.text()
    expect(res.status).toEqual(200)
    expect(res.headers.get('content-type')).toEqual('text/plain')
    expect(body).toEqual('I like cake')
  })
})
