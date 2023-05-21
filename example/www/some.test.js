const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')

const expectedFile = fs.readFileSync(path.join(__dirname, 'some.js')).toString('utf-8')
const expected404 = fs.readFileSync(path.join(__dirname, '404.html')).toString('utf-8')
describe('static js file, some.js', () => {
  it('Should return the right content from get', async () => {
    const res = await fetch('http://localhost:11420/some.js')
    const body = await res.text()
    expect(res.status).toEqual(200)
    expect(body).toEqual(expectedFile)
  })
  it('resolves without .js extension', async () => {
    const res = await fetch('http://localhost:11420/some')
    const body = await res.text()
    expect(res.status).toEqual(200)
    expect(body).toEqual(expectedFile)
  })
  it('Should not make this test file into a route', async () => {
    const res = await fetch(`http://localhost:11420/${__filename}`)
    const body = await res.text()
    expect(res.status).toEqual(404)
    expect(body).toBe(expected404)
  })
})
