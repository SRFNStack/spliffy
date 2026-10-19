// a second server with no middleware at all, so routes take the direct path
import spliffy, { moduleDirname } from '../src/index.mjs'
import path from 'path'

spliffy({
  routeDir: path.join(moduleDirname(import.meta.url), 'bare', 'www'),
  port: 11421,
  logAccess: false
})
