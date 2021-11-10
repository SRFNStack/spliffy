const fetch = require('node-fetch')

describe('nest path params', ()=>{
    it('should call the right route and pass params', async ()=>{
        const res = await fetch('http://localhost:11420/never/gonna/give%20you/up')
        const body = await res.text()
        expect(res.status).toEqual(200)
        expect(res.headers.get('content-type')).toEqual('text/plain')
        expect(body).toBe('never gonna give you up, never gonna let you down')
    })
})