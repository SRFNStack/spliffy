const fetch = require('node-fetch')
const fs = require('fs')

const expectedFile = fs.readFileSync(__dirname+'/../serverImages/cat_eating_pancake.jpg')

describe( "test stream writable response", () => {
    it( "Should return the entire contents of the file", async () => {
        let res = await fetch( "http://localhost:11420/streamWritable");
        let body = await res.buffer();
        expect(res.status).toEqual(200)
        expect(body).toEqual(expectedFile)
        expect(res.headers.get('content-type')).toEqual('img/jpeg')
        expect(res.headers.get('transfer-encoding')).toEqual('chunked')
        expect(res.headers.get('content-disposition')).toEqual('inline; filename="cat_eating_pancake.jpg"')
    } )
} )
