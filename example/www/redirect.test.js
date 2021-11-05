const fetch = require('node-fetch')

describe( "redirect route, redirect.rt.js", () => {
    it( "Should respond with a 301 and correct location header", async () => {
        let res = await fetch( "http://localhost:11420/redirect", {redirect: 'manual'} );
        expect(res.status).toEqual(301)
        expect(res.headers.get('location')).toEqual('http://localhost:11420/')
    } )
} )