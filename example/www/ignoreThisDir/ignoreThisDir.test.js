const fetch = require('node-fetch')

describe('test ignoreThisDir ignoreFilesMatching ^ignore', () => {
  it('Should ignore both files in ignoreThisDir', async () => {
    const res = await fetch('http://127.0.0.1:11420/ignoreThisDir/andThisFile.html')
    expect(res.status).toEqual(404)
    const res2 = await fetch('http://127.0.0.1:11420/ignoreThisDir/andThisRoute.rt.js')
    expect(res2.status).toEqual(404)
  })
})
