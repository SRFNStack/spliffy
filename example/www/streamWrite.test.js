const fetch = require('node-fetch')

const expectedHtml = '<html lang="en"><body>Particles<ul>' +
    '<li>baryon</li>' +
    '<li>bottom quark</li>' +
    '<li>chargino</li>' +
    '<li>charm quark</li>' +
    '<li>down quark</li>' +
    '<li>electron</li>' +
    '<li>electron neutrino</li>' +
    '<li>fermion</li>' +
    '<li>gluino</li>' +
    '<li>gluon</li>' +
    '<li>gravitino</li>' +
    '<li>graviton</li>' +
    '<li>boson</li>' +
    '<li>higgs boson</li>' +
    '<li>higgsino</li>' +
    '<li>neutralino</li>' +
    '<li>neutron</li>' +
    '<li>meson</li>' +
    '<li>muon</li>' +
    '<li>muon nuetrino</li>' +
    '<li>positron</li>' +
    '<li>photino</li>' +
    '<li>photon</li>' +
    '<li>proton</li>' +
    '<li>sleptons</li>' +
    '<li>sneutrino</li>' +
    '<li>strange quark</li>' +
    '<li>squark</li>' +
    '<li>tau</li>' +
    '<li>tau neutrino</li>' +
    '<li>top quark</li>' +
    '<li>up quark</li>' +
    '<li>w boson</li>' +
    '<li>wino</li>' +
    '<li>z boson</li>' +
    '<li>zino</li>' +
    '</ul></body></html>'

describe( "test write to response", () => {
    it( "Should return all of the written chunks", async () => {
        let res = await fetch( "http://localhost:11420/streamWrite");
        let body = await res.text();
        expect(res.status).toEqual(200)
        expect(body).toEqual(expectedHtml)
        expect(res.headers.get('transfer-encoding')).toEqual('chunked')
        expect(res.headers.get('content-type')).toEqual('text/html')
    } )
} )
