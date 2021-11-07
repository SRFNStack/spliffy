const fetch = require('node-fetch')
const fs = require('fs')

const expectedFile = fs.readFileSync(__dirname+'/../serverImages/cat_eating_pancake.jpg')

describe( "test stream readable body", () => {
    it( "Should return the entire contents of the file", async () => {
        let res = await fetch( "http://localhost:11420/streamReadable");
        let body = await res.buffer();
        expect(res.status).toEqual(200)
        expect(body).toEqual(expectedFile)
        expect(res.headers.get('content-type')).toEqual('img/jpeg')
    } )
} )
