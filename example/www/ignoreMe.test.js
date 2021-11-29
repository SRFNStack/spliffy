const fetch = require('node-fetch')

describe('test ignoreFilesMatching ^ignore pattern with file', () => {
  it('Should ignore ignoreMe.rt.js', async () => {
    const res = await fetch('http://localhost:11420/ignoreMe')
    expect(res.status).toEqual(404)
  })
})
