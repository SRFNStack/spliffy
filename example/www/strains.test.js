
const fetch = require('node-fetch')

describe('catch all route, strains+.rt.js', () => {
  it('Should match strains without anything extra', async () => {
    const res = await fetch('http://127.0.0.1:11420/strains')
    const body = await res.json()
    expect(res.status).toEqual(200)
    expect(body).toEqual({
      path: '/strains',
      query: {},
      pathParameters: {}
    })
    expect(res.headers.get('content-type')).toEqual('potato')
  })

  it('Should parse query params', async () => {
    const res = await fetch('http://127.0.0.1:11420/strains?foo=bar%20baz&baz=foo&baz=bar&baz=baz')
    const body = await res.json()
    expect(res.status).toEqual(200)
    expect(body).toEqual({
      path: '/strains',
      query: {
        foo: 'bar baz',
        baz: ['foo', 'bar', 'baz']
      },
      pathParameters: {}
    })
    expect(res.headers.get('content-type')).toEqual('potato')
  })

  it('Should respond to additional path segment', async () => {
    const res = await fetch('http://127.0.0.1:11420/strains/gorillaGlue?isGood=true')
    const body = await res.json()
    expect(res.status).toEqual(200)
    expect(body).toEqual({
      path: '/strains/gorillaGlue',
      query: {
        isGood: 'true'
      },
      pathParameters: {}
    })
    expect(res.headers.get('content-type')).toEqual('potato')
  })

  it('Should respond to path with lots of segments', async () => {
    const res = await fetch('http://127.0.0.1:11420/strains/foo/bar/baz')
    const body = await res.json()
    expect(res.status).toEqual(200)
    expect(body).toEqual({
      path: '/strains/foo/bar/baz',
      query: {},
      pathParameters: {}
    })
    expect(res.headers.get('content-type')).toEqual('potato')
  })
})
