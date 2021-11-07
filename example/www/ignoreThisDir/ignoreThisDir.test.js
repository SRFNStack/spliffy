const fetch = require('node-fetch')

describe( "test ignoreThisDir ignoreFilesMatching ^ignore", () => {
    it( "Should ignore both files in ignoreThisDir", async () => {
        let res = await fetch( "http://localhost:11420/ignoreThisDir/andThisFile.html" );
        expect(res.status).toEqual(404)
        let res2 = await fetch( "http://localhost:11420/ignoreThisDir/andThisRoute.rt.js" );
        expect(res2.status).toEqual(404)
    } )
} )