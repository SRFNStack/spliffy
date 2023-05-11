const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const expectedFile = fs.readFileSync(path.join(__dirname, 'big_hubble_pic.tif'))
const expectedMd5 = '3a62c497a720978e97c22d42ca34706a'

function md5 (buffer) {
  const hash = crypto.createHash('md5')
  hash.setEncoding('hex')
  hash.write(buffer)
  hash.end()
  return hash.read()
}

describe('large static file', () => {
  it('should load the entire contents correctly', async () => {
    const res = await fetch('http://127.0.0.1:11420/big_hubble_pic.tif')
    const body = await res.buffer()
    expect(res.headers.get('content-type')).toEqual('image/tiff')
    expect(body.equals(expectedFile)).toBe(true)
    expect(md5(body)).toEqual(expectedMd5)
  })
})
