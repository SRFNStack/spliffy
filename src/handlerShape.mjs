const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

/**
 * The names a handler can reach on its context, read from its source. A handler that destructures
 * its single parameter, `({ url, body }) => ...`, can only touch the names it lists, so the request
 * fields it never lists need not be read before the uws request dies. Anything else (a named
 * parameter, a rest element, computed keys, `arguments`) answers null: the handler may reach
 * everything.
 * @returns {Set<string>|null}
 */
export function contextNames (handler) {
  let src
  try {
    src = Function.prototype.toString.call(handler)
  } catch (e) {
    return null
  }
  if (src.indexOf('[native code]') !== -1 || src.indexOf('arguments') !== -1) return null
  const paren = src.indexOf('(')
  const arrow = src.indexOf('=>')
  // a bare parameter arrow, ctx => ..., has no parenthesis ahead of the arrow
  if (paren === -1 || (arrow !== -1 && arrow < paren)) return null
  let i = paren + 1
  while (i < src.length && src.charCodeAt(i) <= 32) i++
  if (src[i] !== '{') return null
  // the pattern runs to the brace that closes it
  let depth = 0
  let end = -1
  for (let j = i; j < src.length; j++) {
    const c = src[j]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        end = j
        break
      }
    } else if (c === '"' || c === "'" || c === '`' || c === '[' || c === '(') {
      // strings, computed keys and calls in defaults are more than this reader follows
      return null
    }
  }
  if (end === -1) return null
  let k = end + 1
  while (k < src.length && src.charCodeAt(k) <= 32) k++
  if (src[k] !== ')') return null
  const pattern = src.slice(i + 1, end)
  if (pattern.indexOf('...') !== -1) return null
  const names = new Set()
  // top level entries, nested patterns keep their own commas behind their braces
  depth = 0
  let start = 0
  for (let j = 0; j <= pattern.length; j++) {
    const c = j < pattern.length ? pattern[j] : ','
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === ',' && depth === 0) {
      const entry = pattern.slice(start, j)
      start = j + 1
      let name = entry
      const colon = entry.indexOf(':')
      const eq = entry.indexOf('=')
      if (colon !== -1 && (eq === -1 || colon < eq)) name = entry.slice(0, colon)
      else if (eq !== -1) name = entry.slice(0, eq)
      name = name.trim()
      if (name === '') continue
      if (!IDENTIFIER.test(name)) return null
      names.add(name)
    }
  }
  return names
}

/**
 * Whether a handler can reach the request headers: through headers, cookies or the request itself
 */
export const readsHeaders = names => names === null || names.has('headers') || names.has('cookies') || names.has('req')
