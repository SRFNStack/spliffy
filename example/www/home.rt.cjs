const marquee = require('../templates/marquee.cjs')

module.exports = {
  GET: () => ({
    headers: {
      'content-type': 'text/html'
    },
    body: `
    <html>
    <body>
    ${marquee('shenanigans', 10) || ''}
    </body>
    </html>
    `
  })
}
