const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const expectedFile = fs.readFileSync(path.join(__dirname,'big_hubble_pic.tif'))
const expectedMd5 = '3a62c497a720978e97c22d42ca34706a'
let uploadedFilepath = path.join(__dirname, '../serverImages/uploads/hubble.tif');

async function md5(buffer) {
    const hash = crypto.createHash( 'md5' );
    hash.setEncoding('hex')
    hash.write(buffer)
    hash.end()
    return hash.read();
}

afterEach(()=>{
    fs.unlinkSync(path.resolve(uploadedFilepath))
})
describe("streaming request body", ()=>{
    it("receives and stores the whole file correctly", async ()=>{
        const res = await fetch('http://localhost:11420/streamRequest?filename=hubble.tif', {
            method: 'POST',
            body: expectedFile
        })
        expect(res.status).toBe(200)
        const uploadedFile = fs.readFileSync(uploadedFilepath)
        //jest toEqual is slow on this big file
        expect(uploadedFile.equals(expectedFile)).toEqual(true)
        const uploadedMd5 = await md5(uploadedFile)
        expect(uploadedMd5).toEqual(expectedMd5)
    })
})