import contentTypes from './content-types.mjs'
import { parseQuery } from './url.mjs'

// a quick look at the first byte so content that cannot be json is handed back without paying for
// the exception JSON.parse would throw
const JSON_STARTS = new Set([0x7b, 0x5b, 0x22, 0x2d, 0x74, 0x66, 0x6e, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39]) // { [ " - t f n 0-9
const looksLikeJson = o => {
  const isString = typeof o === 'string'
  for (let i = 0, l = o.length; i < l; i++) {
    const c = isString ? o.charCodeAt(i) : o[i]
    if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) continue
    return JSON_STARTS.has(c)
  }
  return false
}

const defaultHandler = {
  deserialize: o => {
    if (!o || o.length === 0 || !looksLikeJson(o)) return o
    try {
      return JSON.parse(o.toString())
    } catch (e) {
      return o
    }
  },
  serialize: o => {
    if (!o) return { data: o }
    if (typeof o === 'string') {
      return {
        contentType: 'text/plain',
        data: o
      }
    }
    if (o instanceof Buffer) {
      return {
        contentType: 'application/octet-stream',
        data: o
      }
    }
    return {
      contentType: 'application/json',
      data: JSON.stringify(o)
    }
  }
}

const toFormData = (key, value) => {
  if (Array.isArray(value)) {
    return value.map(toFormData).flat()
  } else if (typeof value === 'object') {
    return Object.keys(value).map(k => toFormData(`${key}.${k}`, value[k])).flat()
  } else {
    return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
  }
}

const contentHandlers = {
  'application/json': {
    deserialize: s => (s && s.length > 0) ? JSON.parse(s.toString()) : s,
    serialize: o => o && JSON.stringify(o)
  },
  'text/plain': {
    deserialize: s => s && s.toString(),
    serialize: o => o && o.toString()
  },
  'application/octet-stream': defaultHandler,
  'application/x-www-form-urlencoded': {
    deserialize: s => s && parseQuery(s.toString(), true),
    serialize: o => o && Object.keys(o).map(toFormData).flat().join('&')
  },
  '*/*': defaultHandler
}

function getHandler (contentType, acceptsDefault) {
  if (!contentType) return contentHandlers[acceptsDefault]
  // content-type is singular https://greenbytes.de/tech/webdav/rfc2616.html#rfc.section.14.17
  let handler = contentHandlers[contentType]
  if (!handler && contentType.indexOf(';') > -1) {
    handler = contentHandlers[contentType.split(';')[0].trim()]
  }
  if (handler && typeof handler) {
    if (typeof handler.serialize !== 'function') {
      throw new Error(`Content handlers must provide a serialize function. ${handler}`)
    }
    if (typeof handler.deserialize !== 'function') {
      throw new Error(`Content handlers must provide a deserialize function. ${handler}`)
    }
    return handler
  }
  return contentHandlers[acceptsDefault]
}

export function getContentTypeByExtension (name, staticContentTypes) {
  const extension = name.indexOf('.') > -1 ? name.slice(name.lastIndexOf('.')).toLowerCase() : 'default'
  const contentType = staticContentTypes?.[extension] || null

  return contentType || contentTypes[extension]
}

export function serializeBody (content, contentType, acceptsDefault) {
  return getHandler(contentType && contentType.toLowerCase(), acceptsDefault).serialize(content)
}

export function deserializeBody (content, contentType, acceptsDefault) {
  return getHandler(contentType && contentType.toLowerCase(), acceptsDefault).deserialize(content)
}

export function initContentHandlers (handlers) {
  return Object.assign({}, contentHandlers, handlers)
}
