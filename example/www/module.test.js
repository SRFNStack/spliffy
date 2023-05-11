const fetch = require('node-fetch')

describe('es6 module route, module.rt.mjs', () => {
  it('Should make a route and allow the exported methods', async () => {
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE', 'PUT']) {
      const res = await fetch('http://127.0.0.1:11420/module', { method })
      expect(res.status).toEqual(200)
      const body = await res.text()
      expect(body).toEqual(`${method} module`)
    }
  })
})
