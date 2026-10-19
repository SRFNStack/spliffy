import fs from 'fs'
import etag from 'etag'
import { compileResponse } from './declarative.mjs'
import { pickEncoding } from './encoding.mjs'

const readFile = async (fullPath) => await new Promise(
  (resolve, reject) =>
    fs.readFile(fullPath, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    }
    )
)

const readStat = async path => new Promise((resolve, reject) =>
  fs.stat(path, (err, stats) =>
    err ? reject(err) : resolve(stats)
  ))

// the precompressed twins a file may have on disk, best first
const VARIANTS = [
  { encoding: 'br', ext: '.br' },
  { encoding: 'gzip', ext: '.gz' }
]
const ENCODINGS = VARIANTS.map(v => v.encoding)

const sameFile = (a, b) => a.mtimeMs === b.mtimeMs && a.size === b.size && a.ino === b.ino

/**
 * One file on disk: the original or a precompressed twin. The cache follows the disk, a stat on every
 * request notices a replaced file and the next response carries the new bytes.
 */
const createVariant = (path, encoding) => ({ path, encoding, stat: null, content: null, etag: null })

const refresh = async (variant, cacheStatic) => {
  let stat
  try {
    stat = await readStat(variant.path)
  } catch (e) {
    variant.stat = null
    variant.content = null
    return false
  }
  if (!stat.isFile()) return false
  if (cacheStatic) {
    if (variant.content === null || !sameFile(variant.stat, stat)) {
      variant.content = await readFile(variant.path)
      variant.etag = etag(variant.content)
    }
  } else {
    variant.etag = etag(stat)
  }
  variant.stat = stat
  return true
}

/**
 * Serve one static file. With precompressed, a .br or .gz file next to the original is sent instead when
 * the request accepts that encoding, with the original's content type and a matching content-encoding.
 */
export function createStaticHandler (fullPath, contentType, cacheStatic, staticCacheControl, precompressed) {
  const original = createVariant(fullPath, null)
  const twins = precompressed ? VARIANTS.map(v => createVariant(fullPath + v.ext, v.encoding)) : null
  const cacheControl = staticCacheControl || 'max-age=600'

  const pickVariant = async (req) => {
    if (twins) {
      const accepted = pickEncoding(req.headers['accept-encoding'], ENCODINGS)
      if (accepted) {
        for (const twin of twins) {
          if (twin.encoding === accepted && await refresh(twin, cacheStatic)) return twin
        }
      }
    }
    return (await refresh(original, cacheStatic)) ? original : null
  }

  return {
    GET: async ({ req, res }) => {
      const variant = await pickVariant(req)
      if (!variant) {
        return { statusCode: 404 }
      }
      const headers = res.headers
      if (twins) headers.vary = 'accept-encoding'
      if (req.headers['if-none-match'] === variant.etag) {
        res.statusCode = 304
        return
      }
      if (contentType) headers['content-type'] = contentType
      if (variant.encoding) headers['content-encoding'] = variant.encoding
      // content-length is left to uws: a streamed file goes out chunked
      headers['cache-control'] = cacheControl
      headers.etag = variant.etag
      if (cacheStatic) {
        return variant.content
      }
      if (variant.stat.size === 0) {
        return ''
      }
      return fs.createReadStream(variant.path)
    }
  }
}

/**
 * Compile a static file into a declarative response: the file, its content type, cache control and
 * etag, served inside uws with nothing running per request. Conditional requests get the full file
 * rather than a 304, there is no javascript to compare the etag, and the bytes are read once at
 * startup, so a file replaced on disk is served again only after a restart.
 * @returns {ArrayBuffer|null} null when the file is missing or bigger than maxSize
 */
export function compileStaticResponse (fullPath, contentType, staticCacheControl, maxSize) {
  if (!fs.existsSync(fullPath)) return null
  const stat = fs.statSync(fullPath)
  if (!stat.isFile() || stat.size > maxSize) return null
  const content = fs.readFileSync(fullPath)
  try {
    return compileResponse({
      headers: {
        'content-type': contentType || undefined,
        'cache-control': staticCacheControl || 'max-age=600',
        etag: etag(content)
      },
      body: content
    })
  } catch (e) {
    return null
  }
}
