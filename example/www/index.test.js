const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')

const expectedFile = fs.readFileSync(path.join(__dirname, '/index.html')).toString('utf-8')
const expected404 = fs.readFileSync(path.join(__dirname, '/404.html')).toString('utf-8')
describe('static files, folder index index.html', () => {
  it('Should return the right content from get root', async () => {
    const res = await fetch('http://localhost:11420')
    const body = await res.text()
    expect(res.status).toEqual(200)
    expect(body).toEqual(expectedFile)
  })
  it('Should return options for the root', async () => {
    const res = await fetch('http://localhost:11420', { method: 'OPTIONS' })
    expect(res.status).toEqual(204)
    expect(res.headers.get('allow')).toEqual('GET')
  })
  it('Should return the right content from get root with slash', async () => {
    const res = await fetch('http://localhost:11420/')
    const body = await res.text()
    expect(res.status).toEqual(200)
    expect(body).toEqual(expectedFile)
  })
  it('Should return options on the slash end point', async () => {
    const res = await fetch('http://localhost:11420/', { method: 'OPTIONS' })
    expect(res.status).toEqual(204)
    expect(res.headers.get('allow')).toEqual('GET')
  })
  it('Should resolve the index file explicitly', async () => {
    const res = await fetch('http://localhost:11420/index.html')
    const body = await res.text()
    expect(res.status).toEqual(200)
    expect(body).toEqual(expectedFile)
  })
  it('Should return options for index.html', async () => {
    const res = await fetch('http://localhost:11420/index.html', { method: 'OPTIONS' })
    expect(res.status).toEqual(204)
    expect(res.headers.get('allow')).toEqual('GET')
  })
  it('Should resolve the index file without .html', async () => {
    const res = await fetch('http://localhost:11420/index')
    const body = await res.text()
    expect(res.status).toEqual(200)
    expect(body).toEqual(expectedFile)
  })
  it('Should return options for /index', async () => {
    const res = await fetch('http://localhost:11420/index', { method: 'OPTIONS' })
    expect(res.status).toEqual(204)
    expect(res.headers.get('allow')).toEqual('GET')
  })
  it('Should not make this test file into a route', async () => {
    const res = await fetch('http://localhost:11420/laksjdflkasldkfj')
    const body = await res.text()
    expect(res.status).toEqual(404)
    expect(body).toBe(expected404)
  })
})
