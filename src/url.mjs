// a key seen twice becomes an array of its values
const addValue = (parsed, key, value) => {
  if (key === '__proto__') return
  const existing = parsed[key]
  if (existing === undefined) {
    parsed[key] = value
  } else if (Array.isArray(existing)) {
    existing.push(value)
  } else {
    parsed[key] = [existing, value]
  }
}

const decode = s => decodeURIComponent(s.indexOf('+') === -1 ? s : s.replace(/\+/g, '%20'))

/**
 * Parse a query string into an object. Keys and values are the wire bytes unless decodeQueryParams
 * is set, then they go through decodeURIComponent with + read as a space. A key given more than once
 * collects its values in an array.
 */
export function parseQuery (query, decodeQueryParams) {
  const parsed = {}
  if (!query) return parsed
  const length = query.length
  let start = 0
  while (start < length) {
    let end = query.indexOf('&', start)
    if (end === -1) end = length
    if (end > start) {
      let eq = query.indexOf('=', start)
      if (eq === -1 || eq > end) eq = end
      let key = query.slice(start, eq)
      let value = eq === end ? '' : query.slice(eq + 1, end)
      if (decodeQueryParams) {
        key = decode(key)
        value = decode(value)
      }
      addValue(parsed, key, value)
    }
    start = end + 1
  }
  return parsed
}

export function setMultiValueKey (obj, key, value) {
  if (key in obj) {
    if (!Array.isArray(obj[key])) {
      obj[key] = [obj[key]]
    }
    obj[key].push(value)
  } else {
    obj[key] = value
  }
}
