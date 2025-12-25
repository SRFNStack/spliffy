import cookie from 'cookie'
import http from 'http'
import { parseQuery } from './url.mjs'
import log from './log.mjs'
import { v4 as uuid } from 'uuid'
import stream from 'stream'
import httpStatusCodes, { defaultStatusMessages } from './httpStatusCodes.mjs'

const { Writable } = stream

const addressArrayBufferToString = addrBuf => Buffer.from(addrBuf).toString()

const excludedMessageProps = {
  setTimeout: true,
  _read: true,
  destroy: true,
  _addHeaderLines: true,
  _addHeaderLine: true,
  _dump: true,
  __proto__: true
}

const reqProtoProps = () => Object.keys(http.IncomingMessage.prototype).filter(p => !excludedMessageProps[p])

class SpliffyRequest {
  constructor (uwsReq, pathParameters, res, config) {
    const query = uwsReq.getQuery()
    this.res = res
    this.path = uwsReq.getUrl()
    this.url = query ? `${this.path}?${query}` : this.path
    this.method = uwsReq.getMethod().toUpperCase()
    this.headers = {}
    uwsReq.forEach((header, value) => {
      this.headers[header] = value
    })

    if (config.extendIncomingMessage) {
      for (const p of reqProtoProps()) {
        if (!this[p]) this[p] = http.IncomingMessage.prototype[p]
      }
    }

    const paramToIndex = pathParameters.reduce((acc, cur, i) => {
      acc[cur] = i
      return acc
    }, {})

    this.spliffyUrl = {
      path: this.path,
      query: (query && parseQuery(query, config.decodeQueryParameters)) || {},
      param: name => uwsReq.getParameter(paramToIndex[name])
    }
    this.query = this.spliffyUrl.query
    if (config.parseCookie) {
      this.cookies = (this.headers.cookie && cookie.parse(this.headers.cookie)) || {}
    }
  }

  get remoteAddress () {
    const val = addressArrayBufferToString(this.res.getRemoteAddressAsText())
    Object.defineProperty(this, 'remoteAddress', { value: val, enumerable: true })
    return val
  }

  get proxiedRemoteAddress () {
    const val = addressArrayBufferToString(this.res.getProxiedRemoteAddressAsText())
    Object.defineProperty(this, 'proxiedRemoteAddress', { value: val, enumerable: true })
    return val
  }

  get (header) {
    return this.headers[header.toLowerCase()]
  }
}

export function decorateRequest (uwsReq, pathParameters, res, config) {
  return new SpliffyRequest(uwsReq, pathParameters, res, config)
}

export function decorateResponse (res, req, finalizeResponse, errorTransformer, endError, config) {
  res.onAborted(() => {
    res.ended = true
    res.writableEnded = true
    res.finalized = true
    log.error(`Request to ${req.url} was aborted`)
  })
  res.acceptsDefault = config.acceptsDefault
  res.headers = {}
  res.headersSent = false
  res.setHeader = (header, value) => {
    res.headers[header.toLowerCase()] = value
  }
  res.removeHeader = header => {
    delete res.headers[header.toLowerCase()]
  }
  res.flushHeaders = () => {
    if (res.headersSent) return
    if (!res.statusCode) res.statusCode = httpStatusCodes.OK
    if (!res.statusMessage) res.statusMessage = defaultStatusMessages[res.statusCode]
    res.headersSent = true
    res.writeStatus(`${res.statusCode} ${res.statusMessage}`)
    if (typeof res.onFlushHeaders === 'function') {
      res.onFlushHeaders(res)
    }
    for (const header in res.headers) {
      const val = res.headers[header]
      if (Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          res.writeHeader(header, val[i].toString())
        }
      } else {
        res.writeHeader(header, val.toString())
      }
    }
  }
  res.writeHead = (status, headers) => {
    res.statusCode = status
    if (headers) res.assignHeaders(headers)
  }
  res.assignHeaders = headers => {
    for (const header in headers) {
      res.headers[header.toLowerCase()] = headers[header]
    }
  }
  res.getHeader = header => {
    return res.headers[header.toLowerCase()]
  }
  res.status = (code) => {
    res.statusCode = code
    return res
  }

  const uwsWrite = res.write
  res.write = (chunk, encoding, cb) => {
    res.cork(() => {
      res.streaming = true
      res.flushHeaders()
      let data
      if (chunk instanceof Buffer || chunk instanceof Uint8Array || typeof chunk === 'string') {
        data = chunk
      } else {
        data = JSON.stringify(chunk)
      }
      const result = uwsWrite.call(res, data)
      if (typeof cb === 'function') cb()
      return result
    })
  }

  res.getWritable = () => {
    if (!res.outStream) {
      res.streaming = true
      res.outStream = new Writable({
        write: (chunk, encoding, callback) => {
          res.write(chunk, encoding, callback)
        }
      })
        .on('finish', () => res.end())
        .on('error', e => {
          try {
            res.outStream.destroy()
          } finally {
            endError(res, e, uuid(), errorTransformer)
          }
        })
    }
    return res.outStream
  }

  const uwsEnd = res.end
  res.ended = false
  res.end = body => {
    if (res.ended) return
    res.cork(() => {
      if (!res.headersSent) res.flushHeaders()
      uwsEnd.call(res, body || '')
      res.writableEnded = true
      res.ended = true
      if (typeof res.onEnd === 'function') res.onEnd()
    })
  }

  res.redirect = (code, location) => {
    if (typeof code === 'string') {
      location = code
      code = httpStatusCodes.MOVED_PERMANENTLY
    }
    return finalizeResponse(req, res, {
      statusCode: code,
      headers: { location }
    })
  }
  res.send = (body) => finalizeResponse(req, res, body)
  res.json = res.send
  res.setCookie = (name, value, options) => {
    const serialized = cookie.serialize(name, value, options)
    const existing = res.getHeader('Set-Cookie')
    if (existing) {
      if (Array.isArray(existing)) existing.push(serialized)
      else res.setHeader('Set-Cookie', [existing, serialized])
    } else {
      res.setHeader('Set-Cookie', serialized)
    }
  }
  res.cookie = res.setCookie
  return res
}
