const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const pipeline = promisify(require('stream').pipeline)
const uploadsPath = path.join(__dirname, '../serverImages/uploads')

module.exports = {
  GET: () => ({
    headers: {
      'Content-Type': 'text/html'
    },
    body: `
        <html lang="en">
        <body>
        An example of streaming a request body in spliffy <br/><br/>
        <input id="file" type="file"/><br/><br/>
        <button id='butty' type="button">Upload</button>
        <script src="upload.js"></script>
        </form>
        </body>
        </html>
        `
  }),
  POST: {
    streamRequestBody: true,
    handler: async ({ url: { query: { filename = 'foo.dat' } }, body }) => pipeline(
      body,
      fs.createWriteStream(path.join(uploadsPath, filename))
    )
  }
}
