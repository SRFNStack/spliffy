const fetch = require('node-fetch')

describe('path param dir', () => {
  it('should get the $strainName end point correctly', async () => {
    const res = await fetch('http://127.0.0.1:11420/gorrila%20glue/info')
    const body = await res.text()
    expect(res.status).toEqual(200)
    expect(res.headers.get('content-type')).toEqual('text/plain')
    expect(body).toBe('gorrila glue is dank')
  })
})
