import uws from 'uWebSockets.js'
import { defaultStatusMessages } from './httpStatusCodes.mjs'

/**
 * Start a declarative response. A declarative response is a handler described up front instead of
 * run per request: it is compiled once at startup and executed entirely inside uWebSockets.js, so
 * requests to the route never enter javascript at all.
 *
 * It can write a status, static headers and body, and copy values from the request: a path
 * parameter, a query parameter, a header or the request body. Call end() last and export the
 * result as the handler.
 *
 * export default {
 *   GET: declarative().writeHeader('content-type', 'text/plain').writeParameterValue('id').end()
 * }
 *
 * Middleware does not run for declarative routes, so a route that has middleware fails to load.
 *
 * @returns {uws.DeclarativeResponse} See https://github.com/uNetworking/uWebSockets.js for the full api
 */
export const declarative = () => new uws.DeclarativeResponse()

/**
 * Whether the given handler is a compiled declarative response
 */
export const isDeclarative = handler => handler instanceof ArrayBuffer

const MAX_U8 = 255
const MAX_U16 = 65535
const toBuffer = v => Buffer.isBuffer(v) ? v : Buffer.from(String(v))

/**
 * Compile a fixed response into a declarative response, in the instruction format uws executes.
 * Unlike declarative(), this takes a whole body at once and splits it into as many instructions as
 * it needs, so it suits bodies bigger than one instruction can carry (64KiB).
 *
 * @param statusCode The status, 200 when omitted
 * @param statusMessage The status message, the default for the status when omitted
 * @param headers Header name to value, or array of values. Names and values are limited to 255 bytes.
 * @param body A string or Buffer
 * @returns {ArrayBuffer} The compiled response, usable as a route handler
 */
export function compileResponse ({ statusCode, statusMessage, headers, body }) {
  const parts = []
  const instruction = (opcode, ...values) => {
    parts.push(Buffer.from([opcode]))
    for (const value of values) {
      const bytes = toBuffer(value)
      if (bytes.length > MAX_U8) throw new RangeError(`Declarative response values are limited to ${MAX_U8} bytes: ${value}`)
      parts.push(Buffer.from([bytes.length]), bytes)
    }
  }
  if (statusCode && statusCode !== 200) {
    instruction(7, `${statusCode} ${statusMessage || defaultStatusMessages[statusCode] || ''}`)
  }
  for (const name in headers) {
    const value = headers[name]
    if (value === undefined || value === null) continue
    for (const v of Array.isArray(value) ? value : [value]) instruction(1, name.toLowerCase(), v)
  }
  const data = body === undefined || body === null ? Buffer.alloc(0) : toBuffer(body)
  if (data.length <= MAX_U16) {
    parts.push(Buffer.from([0, data.length & 0xff, data.length >> 8]), data)
  } else {
    // one write per 64KiB, then an empty end
    for (let offset = 0; offset < data.length; offset += MAX_U16) {
      const chunk = data.subarray(offset, offset + MAX_U16)
      parts.push(Buffer.from([5, chunk.length & 0xff, chunk.length >> 8]), chunk)
    }
    parts.push(Buffer.from([0, 0, 0]))
  }
  const buffer = Buffer.concat(parts)
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length)
}
