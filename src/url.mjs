export function parseQuery (query, decodeQueryParams) {
  const parsed = {}
  if (query) {
    if (decodeQueryParams) {
      query = decodeURIComponent(query.replace(/\+/g, '%20'))
    }
    for (const param of query.split('&')) {
      const eq = param.indexOf('=')
      setMultiValueKey(parsed, param.substr(0, eq), param.substr(eq + 1))
    }
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
