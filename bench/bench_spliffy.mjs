import spliffy from '../src/index.mjs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

spliffy({
  routeDir: path.join(__dirname, 'www'),
  port: 11420,
  logAccess: false,
  logLevel: 'ERROR',
  writeDateHeader: false
})
