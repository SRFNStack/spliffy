const path = require('path')
const childProcess = require('child_process')
let server

module.exports = {
  start: async () => new Promise((resolve, reject) => {
    console.log('Starting spliffy server')
    const timeout = 5_000
    const rejectTimeout = setTimeout(() => {
      reject(new Error(`Server was not initialized within ${timeout}ms`))
    }, timeout)
    server = childProcess.spawn('node', [path.resolve(__dirname, 'example', 'serve.mjs')])
    server.on('error', err => {
      console.log('got error from server', err)
      clearTimeout(rejectTimeout)
      reject(err)
    })
    server.on('exit', (code) => {
      clearTimeout(rejectTimeout)
      if (code === 0) {
        resolve()
      } else {
        reject(new Error('Server exited with status: ' + code))
      }
    })
    server.stdout.setEncoding('utf-8')
    server.stdout.on('data', data => {
      console.log(data)
      if (data.match('Server initialized')) {
        clearTimeout(rejectTimeout)
        // give it a little extra time to initialize
        setTimeout(resolve, 250)
      }
    })
    server.stderr.setEncoding('utf-8')
    server.stderr.on('data', console.error)
  }),
  stop: async () => server.kill()
}
