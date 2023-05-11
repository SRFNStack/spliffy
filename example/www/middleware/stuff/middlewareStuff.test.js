const fetch = require('node-fetch')

describe('middleware method application', () => {
  it('applies all middleware and middleware for specific methods', async () => {
    const res = await fetch('http://127.0.0.1:11420/middleware/stuff', {
      method: 'PUT'
    })
    expect(res.headers.get('all-mw-applied')).toEqual('true')
    expect(res.headers.get('put-mw-applied')).toEqual('true')
    expect(res.headers.get('app-mw-applied')).toEqual('true')
  })
  it('doesn\'t apply middleware it shouldn\'t', async () => {
    const res = await fetch('http://127.0.0.1:11420/middleware/stuff')
    expect(res.headers.get('all-mw-applied')).toEqual('true')
    expect(res.headers.get('put-mw-applied')).toEqual(null)
    const res2 = await fetch('http://127.0.0.1:11420/middleware/stuff', {
      method: 'POST'
    })
    expect(res2.headers.get('all-mw-applied')).toEqual('true')
    expect(res2.headers.get('put-mw-applied')).toEqual(null)
  })
})
