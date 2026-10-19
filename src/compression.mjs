import zlib from 'zlib'
import { pickEncoding } from './encoding.mjs'

const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml|ld\+json|x-www-form-urlencoded|wasm)|image\/svg\+xml)/i

const bufferOf = body => typeof body === 'string' ? Buffer.from(body) : body

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
  const brotliOptions = brotli || { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 3 } }
  const gzipOptions = gzip || { level: 6 }
  const compressible = filter || (contentType => COMPRESSIBLE.test(contentType))

  const compressSync = (encoding, body) => encoding === 'br'
    ? zlib.brotliCompressSync(body, brotliOptions)
    : zlib.gzipSync(body, gzipOptions)
  const compressStream = encoding => encoding === 'br'
    ? zlib.createBrotliCompress(brotliOptions)
    : zlib.createGzip(gzipOptions)

  // whether this response may be compressed, decided once the headers are known
  const shouldCompress = res => {
    const headers = res._h
    if (!headers) return false
    if (headers['content-encoding']) return false
    const contentType = headers['content-type']
    return !!contentType && compressible(String(contentType))
  }

  return (req, res, next) => {
    const encoding = pickEncoding(req.headers['accept-encoding'], encodings)
    if (!encoding) return next()
    const rawWrite = res.write
    const rawEnd = res.end
    let stream = null
    let decided = false
    let compress = false

    const decide = () => {
      decided = true
      compress = shouldCompress(res)
      if (compress) {
        res.headers['content-encoding'] = encoding
        res.headers.vary = res.headers.vary ? res.headers.vary + ', accept-encoding' : 'accept-encoding'
      }
    }

    res.write = function (chunk, enc, cb) {
      if (!decided) decide()
      if (!compress) return rawWrite.call(this, chunk, enc, cb)
      if (stream === null) {
        stream = compressStream(encoding)
        stream.on('data', data => rawWrite.call(this, data))
        stream.on('error', e => this._endError(this, e))
      }
      return stream.write(bufferOf(chunk), cb)
    }

    res.end = function (body) {
      if (stream !== null) {
        stream.once('end', () => rawEnd.call(this))
        stream.end(body ? bufferOf(body) : undefined)
        return
      }
      if (!decided) {
        // a one piece body shorter than the threshold is not worth a compression header
        if (body && body.length >= threshold) decide()
        else decided = true
      }
      rawEnd.call(this, compress && body ? compressSync(encoding, bufferOf(body)) : body)
    }
    next()
  }
}
