const fetch = require('node-fetch')
describe('error middleware', ()=>{
    it('applies error middleware and allows recovering from exceptions', async()=>{
        const res = await fetch('http://localhost:11420/middleware/stuff/errors/oops')
        expect(res.headers.get('error-mw-applied')).toEqual('true')
        expect(res.headers.get('app-mw-applied')).toEqual('true')
        expect(res.headers.get('middleware-was-here')).toEqual('true')
        expect(res.status).toEqual(200)
    })
})