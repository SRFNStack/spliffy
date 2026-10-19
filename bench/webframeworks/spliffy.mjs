// the spliffy entry of https://github.com/the-benchmarker/web-frameworks
// WWW=www_declarative node spliffy.mjs serves the same routes as declarative responses
import spliffy, { moduleDirname } from '../../src/index.mjs'
import path from 'path'

spliffy({
  routeDir: path.join(moduleDirname(import.meta.url), process.env.WWW || 'www'),
  port: 3000,
  logAccess: false,
  logLevel: 'ERROR'
})
