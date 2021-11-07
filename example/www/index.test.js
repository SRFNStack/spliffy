const fetch = require('node-fetch')
const fs = require('fs')

const expectedFile = fs.readFileSync(__dirname+"/index.html").toString('utf-8')
const expected404 = fs.readFileSync(__dirname+"/404.html").toString('utf-8')
describe( "static files, folder index index.html", () => {
    it( "Should return the right content from get root", async () => {
        let res = await fetch( "http://localhost:11420" );
        const body = await res.text()
        expect(res.status).toEqual(200)
        expect(body).toEqual(expectedFile)
    } )
    it( "Should return options for the root", async () => {
        let res = await fetch( "http://localhost:11420", {method: 'OPTIONS'} );
        expect(res.status).toEqual(204)
        expect(res.headers.get('allow')).toEqual("GET")
    } )
    it( "Should return the right content from get root with slash", async () => {
        let res = await fetch( "http://localhost:11420/" );
        const body = await res.text()
        expect(res.status).toEqual(200)
        expect(body).toEqual(expectedFile)
    } )
    it( "Should return options on the slash end point", async () => {
        let res = await fetch( "http://localhost:11420/", {method: 'OPTIONS'} );
        expect(res.status).toEqual(204)
        expect(res.headers.get('allow')).toEqual("GET")
    } )
    it( "Should resolve the index file explicitly", async () => {
        let res = await fetch( "http://localhost:11420/index.html" );
        const body = await res.text()
        expect(res.status).toEqual(200)
        expect(body).toEqual(expectedFile)
    } )
    it( "Should return options for index.html", async () => {
        let res = await fetch( "http://localhost:11420/index.html", {method: 'OPTIONS'} );
        expect(res.status).toEqual(204)
        expect(res.headers.get('allow')).toEqual("GET")
    } )
    it( "Should resolve the index file without .html", async () => {
        let res = await fetch( "http://localhost:11420/index" );
        const body = await res.text()
        expect(res.status).toEqual(200)
        expect(body).toEqual(expectedFile)
    } )
    it( "Should return options for /index", async () => {
        let res = await fetch( "http://localhost:11420/index", {method: 'OPTIONS'} );
        expect(res.status).toEqual(204)
        expect(res.headers.get('allow')).toEqual("GET")
    } )
    it("Should not make this test file into a route", async()=>{
        let res = await fetch( `http://localhost:11420/${__filename}` );
        const body = await res.text()
        expect(res.status).toEqual(404)
        expect(body).toBe(expected404)
    })
} )