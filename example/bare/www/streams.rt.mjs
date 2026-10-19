import fs from 'fs'
import path from 'path'
import { moduleDirname } from '../../../src/index.mjs'
import { pipeline } from 'stream/promises'

const file = path.join(moduleDirname(import.meta.url), 'static', 'hello.txt')

export default {
  // a readable returned from a handler is piped
  GET: () => fs.createReadStream(file),
  // written by hand
  POST: ({ res }) => { res.write('a'); res.write('b'); res.end('c') },
  // piped into the response as a writable, after an await
  PUT: async ({ res }) => { res.headers['content-type'] = 'text/plain'; await pipeline(fs.createReadStream(file), res.getWritable()) },
  // the request body as a stream
  PATCH: { streamRequestBody: true, handler: async ({ bodyPromise }) => { const chunks = []; for await (const c of await bodyPromise) chunks.push(c); return { got: Buffer.concat(chunks).toString() } } },
  // ends after an await, outside the uws callback
  DELETE: async () => { await new Promise(resolve => setTimeout(resolve, 2)); return 'late' }
}
