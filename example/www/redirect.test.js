const fetch = require('node-fetch')

describe('redirect route, redirect.rt.js', () => {
  it('Should respond with a 301 and correct location header', async () => {
    const res = await fetch('http://127.0.0.1:11420/redirect', { redirect: 'manual' })
    expect(res.status).toEqual(301)
    expect(res.headers.get('location')).toEqual('http://127.0.0.1:11420/')
  })
})
