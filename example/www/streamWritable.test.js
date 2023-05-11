const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')

const expectedFile = fs.readFileSync(path.resolve(__dirname, '../serverImages/cat_eating_pancake.jpg'))

describe('test stream writable response', () => {
  it('Should return the entire contents of the file', async () => {
    const res = await fetch('http://127.0.0.1:11420/streamWritable')
    const body = await res.buffer()
    expect(res.status).toEqual(200)
    expect(body).toEqual(expectedFile)
    expect(res.headers.get('content-type')).toEqual('img/jpeg')
    expect(res.headers.get('transfer-encoding')).toEqual('chunked')
    expect(res.headers.get('content-disposition')).toEqual('inline; filename="cat_eating_pancake.jpg"')
  })
})
