const fetch = require('node-fetch')

describe('test ignoreFilesMatching cantLoadThis pattern with file', () => {
  it('Should ignore cantLoadThis.rt.js', async () => {
    const res = await fetch('http://localhost:11420/testIgnore/cantLoadThis')
    expect(res.status).toEqual(404)
  })

  it('Should load testIgnore index', async () => {
    const res = await fetch('http://localhost:11420/testIgnore')
    const body = await res.text()
    expect(res.status).toEqual(200)
    expect(body).toBe('This is ok though')
  })
})
