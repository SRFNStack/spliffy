import zlib from 'zlib'
import { pickEncoding } from './encoding.mjs'

const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml|ld\+json|x-www-form-urlencoded|wasm)|image\/svg\+xml)/i

const bufferOf = body => typeof body === 'string' ? Buffer.from(body) : body

const { BROTLI_PARAM_QUALITY, BROTLI_PARAM_LGWIN, BROTLI_MIN_WINDOW_BITS, BROTLI_MAX_WINDOW_BITS } = zlib.constants
const BROTLI_DEFAULT_LGWIN = 22
// the smallest power of two window that holds the whole body: a window beyond the body is memory
// the compressor allocates and clears for nothing, which for a few kilobytes costs more than compressing them
const windowBitsFor = (length, min, max) => Math.min(max, Math.max(min, 32 - Math.clz32(length - 1)))

/**
 * The options for a body of a known size: the configured options with a window fitted to the body,
 * built once per window size
 */
class SizedOptions {
  constructor (brotli, gzip) {
    this.brotli = brotli
    this.gzip = gzip
    this.brotliBySize = brotli.params && brotli.params[BROTLI_PARAM_LGWIN] === undefined ? new Map() : null
    this.gzipBySize = gzip.windowBits === undefined ? new Map() : null
  }

  brotliFor (length) {
    if (this.brotliBySize === null) return this.brotli
    const bits = windowBitsFor(length, BROTLI_MIN_WINDOW_BITS, Math.min(BROTLI_MAX_WINDOW_BITS, BROTLI_DEFAULT_LGWIN))
    let options = this.brotliBySize.get(bits)
    if (!options) {
      options = { ...this.brotli, params: { ...this.brotli.params, [BROTLI_PARAM_LGWIN]: bits } }
      this.brotliBySize.set(bits, options)
    }
    return options
  }

  gzipFor (length) {
    if (this.gzipBySize === null) return this.gzip
    // deflate windows run from 2^9 to 2^15, the hash memory follows the window
    const bits = windowBitsFor(length, 9, 15)
    let options = this.gzipBySize.get(bits)
    if (!options) {
      options = { ...this.gzip, windowBits: bits }
      if (this.gzip.memLevel === undefined) options.memLevel = Math.max(1, Math.min(9, bits - 6))
      this.gzipBySize.set(bits, options)
    }
    return options
  }
}

// whether this response may be compressed, decided once the headers are known
const shouldCompress = (res, compressible) => {
  const headers = res._h
  if (!headers) return false
  if (headers['content-encoding']) return false
  const contentType = headers['content-type']
  return !!contentType && compressible(String(contentType))
}

/**
 * The state of one compressed response, so the write and end replacements below are shared
 * functions rather than closures made per request
 */
class Compressing {
  constructor (options, encoding, rawWrite, rawEnd) {
    this.options = options
    this.encoding = encoding
    this.rawWrite = rawWrite
    this.rawEnd = rawEnd
    this.stream = null
    this.decided = false
    this.compress = false
  }

  decide (res) {
    this.decided = true
    this.compress = shouldCompress(res, this.options.compressible)
    if (this.compress) {
      res.headers['content-encoding'] = this.encoding
      res.headers.vary = res.headers.vary ? res.headers.vary + ', accept-encoding' : 'accept-encoding'
    }
  }

  compressSync (body) {
    const sized = this.options.sized
    return this.encoding === 'br'
      ? zlib.brotliCompressSync(body, sized.brotliFor(body.length))
      : zlib.gzipSync(body, sized.gzipFor(body.length))
  }

  openStream (res) {
    const stream = this.encoding === 'br'
      ? zlib.createBrotliCompress(this.options.brotli)
      : zlib.createGzip(this.options.gzip)
    const rawWrite = this.rawWrite
    stream.on('data', data => rawWrite.call(res, data))
    stream.on('error', e => res._endError(res, e))
    this.stream = stream
  }
}

function compressedWrite (chunk, enc, cb) {
  const state = this._compressing
  if (!state.decided) state.decide(this)
  if (!state.compress) return state.rawWrite.call(this, chunk, enc, cb)
  if (state.stream === null) state.openStream(this)
  return state.stream.write(bufferOf(chunk), cb)
}

function compressedEnd (body) {
  const state = this._compressing
  if (state.stream !== null) {
    const rawEnd = state.rawEnd
    state.stream.once('end', () => rawEnd.call(this))
    state.stream.end(body ? bufferOf(body) : undefined)
    return
  }
  if (!state.decided) {
    // a one piece body shorter than the threshold is not worth a compression header
    if (body && body.length >= state.options.threshold) state.decide(this)
    else state.decided = true
  }
  state.rawEnd.call(this, state.compress && body ? state.compressSync(bufferOf(body)) : body)
}

/**
 * Middleware that compresses responses the client accepts compressed. Bodies sent in one piece are
 * compressed in one call, written bodies go through a compression stream. Responses that already carry a
 * content-encoding, are shorter than threshold or have a content type that is not text are left alone.
 *
 * @param options.encodings The encodings to offer, in order of preference. Default ['br', 'gzip']
 * @param options.threshold The smallest body to compress, in bytes. Default 1024
 * @param options.brotli zlib brotli options. Default quality 3, which is smaller than gzip at level 6 and faster
 * @param options.gzip zlib gzip options. Default level 6
 * @param options.filter (contentType) => boolean to decide what gets compressed. Default text, json, javascript, xml and svg
 */
export function compression ({ encodings = ['br', 'gzip'], threshold = 1024, brotli, gzip, filter } = {}) {
  const options = {
    threshold,
    brotli: brotli || { params: { [BROTLI_PARAM_QUALITY]: 3 } },
    gzip: gzip || { level: 6 },
    compressible: filter || (contentType => COMPRESSIBLE.test(contentType))
  }
  options.sized = new SizedOptions(options.brotli, options.gzip)

  return (req, res, next) => {
    const encoding = pickEncoding(req.headers['accept-encoding'], encodings)
    if (encoding) {
      res._compressing = new Compressing(options, encoding, res.write, res.end)
      res.write = compressedWrite
      res.end = compressedEnd
    }
    next()
  }
}
