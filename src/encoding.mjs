/**
 * Pick the content encoding to send from an accept-encoding header.
 * @param accept The accept-encoding header value, for example "br;q=1, gzip;q=0.8"
 * @param encodings The encodings the server can send, in order of preference
 * @returns {string|null} The first of encodings the client accepts with a non zero q, or null
 */
export function pickEncoding (accept, encodings) {
  if (!accept) return null
  let best = null
  let bestIndex = encodings.length
  let start = 0
  const length = accept.length
  while (start < length) {
    let end = accept.indexOf(',', start)
    if (end === -1) end = length
    let token = accept.slice(start, end).trim()
    start = end + 1
    let q = 1
    const semi = token.indexOf(';')
    if (semi !== -1) {
      const params = token.slice(semi + 1)
      token = token.slice(0, semi).trim()
      const qAt = params.indexOf('q=')
      if (qAt !== -1) q = parseFloat(params.slice(qAt + 2))
    }
    if (q === 0 || !(q > 0)) continue
    const index = token === '*' ? 0 : encodings.indexOf(token.toLowerCase())
    if (index !== -1 && index < bestIndex) {
      bestIndex = index
      best = encodings[index]
      if (index === 0) break
    }
  }
  return best
}
