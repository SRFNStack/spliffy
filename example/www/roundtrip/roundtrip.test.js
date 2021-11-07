const fetch = require('node-fetch')
const fs = require('fs')

const expectedCheech = fs.readFileSync(__dirname+"/cheech.html").toString('utf-8')
const expectedCheechFun = fs.readFileSync(__dirname+"/cheechFun.js").toString('utf-8')
describe('roundtrip test', ()=>{
    it('Loads the html from /roundTrip/cheech', async ()=>{
        const res = await fetch('http://localhost:11420/roundtrip/cheech')
        const cheech = await res.text()
        expect(res.status).toBe(200)
        expect(res.headers.get('transfer-encoding')).toBe('chunked')
        expect(cheech).toEqual(expectedCheech)
    })

    it('Loads the js from /roundTrip/cheechFun', async ()=>{
        const res = await fetch('http://localhost:11420/roundtrip/cheechFun')
        const cheechFun = await res.text()
        expect(res.status).toBe(200)
        expect(res.headers.get('transfer-encoding')).toBe('chunked')
        expect(cheechFun).toEqual(expectedCheechFun)
    })

    it('chong puffs and passes', async ()=>{
        let input = {
            puff: {
                puff: {
                    pass: true
                }
            }
        };
        const res = await fetch(`http://localhost:11420/roundtrip/chong?q=${encodeURIComponent('Hey man, am I driving ok?')}`, {
            method: 'POST',
            body: JSON.stringify(input),
            headers: {
                'content-type': 'application/json'
            }
        })
        const chong = await res.json()
        expect(res.status).toBe(200)
        expect(chong).toEqual( {
            ...input,
            query: {
                q: 'Hey man, am I driving ok?'
            },
            responseMessage:"I think we're parked man"
        })
    })
})