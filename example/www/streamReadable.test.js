const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')

const expectedFile = fs.readFileSync(path.resolve(__dirname, '../serverImages/cat_eating_pancake.jpg'))

describe('test stream readable body', () => {
  it('Should return the entire contents of the file', async () => {
    const res = await fetch('http://localhost:11420/streamReadable')
    const body = await res.buffer()
    expect(res.status).toEqual(200)
    expect(body).toEqual(expectedFile)
    expect(res.headers.get('content-type')).toEqual('img/jpeg')
    expect(res.headers.get('transfer-encoding')).toEqual('chunked')
  })
})
