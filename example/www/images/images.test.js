const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')
const expectedFile = fs.readFileSync(path.join(__dirname, 'logo.spliff'))

describe('custom mime type', () => {
  it('should return the right mime type for the .spliff extension', async () => {
    const res = await fetch('http://localhost:11420/images/logo.spliff')
    const body = await res.buffer()
    expect(res.status).toEqual(200)
    expect(res.headers.get('content-type')).toEqual('image/png')
    expect(body.equals(expectedFile)).toBe(true)
  })
  it('should get the $foo end point correctly', async () => {
    const res = await fetch('http://localhost:11420/images/taco.jaco')
    const body = await res.text()
    expect(res.status).toEqual(200)
    expect(res.headers.get('content-type')).toEqual('text/plain')
    expect(body).toBe('got parameter taco.jaco')
  })
})
