import cookie from 'cookie'
import http from 'http'
import { parseQuery } from './url.mjs'
import { v4 as uuid } from 'uuid'
import stream from 'stream'
import { defaultStatusMessages } from './httpStatusCodes.mjs'

const { Writable } = stream

const excludedMessageProps = {
  setTimeout: true, _read: true, destroy: true, _addHeaderLines: true, _addHeaderLine: true, _dump: true, __proto__: true
}

let _reqProtoProps = null
const getReqProtoProps = () => {
  if (!_reqProtoProps) {
    _reqProtoProps = Object.keys(http.IncomingMessage.prototype).filter(p => !excludedMessageProps[p])
  }
  return _reqProtoProps
}

export class SpliffyRequest {
  constructor (uwsReq, pathParameters, res, config) {
    this.init(uwsReq, pathParameters, res, config)
  }

  init (uwsReq, pathParameters, res, config) {
    this.res = res
    this._uwsReq = uwsReq
    this._config = config
    this._pathParameters = pathParameters
    this.path = uwsReq ? uwsReq.getUrl() : ''
    this.method = uwsReq ? uwsReq.getMethod().toUpperCase() : ''
    this._url = null
    this._headers = null
    this._spliffyUrl = null
    this._cookies = null
    this.startTime = Date.now()

    if (uwsReq) {
      this._cacheHeaders()
      this._cacheSpliffyUrl()
    }

    if (config.extendIncomingMessage && uwsReq) {
      const proto = http.IncomingMessage.prototype
      for (const p of getReqProtoProps()) {
        if (!this[p]) this[p] = proto[p]
      }
    }
  }

  _cacheHeaders () {
    if (this._headers === null) {
      this._headers = {}
      this._uwsReq.forEach((header, value) => { this._headers[header] = value })
    }
  }

  _cacheSpliffyUrl () {
    if (this._spliffyUrl === null) {
      const q = this._uwsReq.getQuery()
      const p2i = this._pathParameters.reduce((acc, cur, i) => { acc[cur] = i; return acc }, {})
      const params = {}
      for (const name in p2i) {
        params[name] = this._uwsReq.getParameter(p2i[name])
      }
      this._spliffyUrl = {
        path: this.path,
        query: (q && parseQuery(q, this._config.decodeQueryParameters)) || {},
        param: name => params[name]
      }
    }
  }

  get url () {
    if (this._url === null) {
      const q = this._uwsReq.getQuery()
      this._url = q ? `${this.path}?${q}` : this.path
    }
    return this._url
  }

  get headers () {
    this._cacheHeaders()
    return this._headers
  }

  get spliffyUrl () {
    this._cacheSpliffyUrl()
    return this._spliffyUrl
  }

  get query () { return this.spliffyUrl.query }
  get cookies () {
    if (this._cookies === null) {
      this._cookies = (this.headers.cookie && cookie.parse(this.headers.cookie)) || {}
    }
    return this._cookies
  }

  get remoteAddress () {
    const val = Buffer.from(this.res.getRemoteAddressAsText()).toString()
    Object.defineProperty(this, 'remoteAddress', { value: val, enumerable: true })
    return val
  }

  get proxiedRemoteAddress () {
    const val = Buffer.from(this.res.getProxiedRemoteAddressAsText()).toString()
    Object.defineProperty(this, 'proxiedRemoteAddress', { value: val, enumerable: true })
    return val
  }

  get (header) { return this.headers[header.toLowerCase()] }
}

export function decorateRequest (uwsReq, pathParameters, res, config) {
  return new SpliffyRequest(uwsReq, pathParameters, res, config)
}

const resProto = {
  setHeader (h, v) { this.headers[h.toLowerCase()] = v },
  removeHeader (h) { delete this.headers[h.toLowerCase()] },
  assignHeaders (headers) {
    for (const h in headers) { this.headers[h.toLowerCase()] = headers[h] }
  },
  getHeader (h) { return this.headers[h.toLowerCase()] },
  status (c) { this.statusCode = c; return this },
  writeHead (s, h) { this.statusCode = s; if (h) this.assignHeaders(h) },
  flushHeaders () {
    if (this.headersSent) return
    this.headersSent = true
    if (this.statusCode && this.statusCode !== 200) {
      this.writeStatus(this.statusCode + ' ' + (defaultStatusMessages[this.statusCode] || ''))
    }
    for (const h in this.headers) {
      const v = this.headers[h]
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) this.writeHeader(h, String(v[i]))
      } else {
        try {
          this.writeHeader(h, String(v))
        } catch (e) {
          throw new Error(`Error writing header ${h}: ${e.message}`)
        }
      }
    }
  },
  ensureOnAborted () {
    if (this._onAbortedRegistered) return
    this._onAbortedRegistered = true
    this.onAborted(() => { this.ended = true; this.writableEnded = true; this.finalized = true })
  }
}

export function decorateResponse (res, req, finalizeResponse, errorTransformer, endError, config) {
  res._onAbortedRegistered = false
  res.ensureOnAborted = resProto.ensureOnAborted
  res.acceptsDefault = config.acceptsDefault
  res.headers = {}
  res.headersSent = false
  res.setHeader = resProto.setHeader
  res.removeHeader = resProto.removeHeader
  res.assignHeaders = resProto.assignHeaders
  res.getHeader = resProto.getHeader
  res.status = resProto.status
  res.writeHead = resProto.writeHead
  res.flushHeaders = resProto.flushHeaders

  const uwsWrite = res.write
  res.write = (chunk, encoding, cb) => {
    res.ensureOnAborted()
    res.cork(() => {
      res.streaming = true
      if (!res.headersSent) res.flushHeaders()
      uwsWrite.call(res, (chunk instanceof Buffer || chunk instanceof Uint8Array || typeof chunk === 'string') ? chunk : JSON.stringify(chunk))
      if (typeof cb === 'function') cb()
    })
  }

  res.getWritable = () => {
    res.ensureOnAborted()
    if (!res.outStream) {
      res.streaming = true
      res.outStream = new Writable({ write: (c, e, callback) => { res.write(c, e, callback) } })
        .on('finish', () => res.end())
        .on('error', e => { try { res.outStream.destroy() } finally { endError(res, e, uuid(), errorTransformer) } })
    }
    return res.outStream
  }

  const uwsEnd = res.end
  res.ended = false
  res.end = body => {
    if (res.ended) return
    res.ended = true
    res.writableEnded = true
    res.cork(() => {
      if (!res.headersSent) res.flushHeaders()
      uwsEnd.call(res, body || '')
      if (typeof res.onEnd === 'function') res.onEnd()
    })
  }

  res.redirect = (c, l) => {
    if (typeof c === 'string') { l = c; c = 301 }
    return finalizeResponse(req, res, { statusCode: c, headers: { location: l } })
  }
  res.send = (b) => finalizeResponse(req, res, b)
  res.json = res.send
  res.setCookie = (n, v, o) => {
    const s = cookie.serialize(n, v, o)
    const e = res.headers['set-cookie']
    if (e) {
      if (Array.isArray(e)) e.push(s)
      else res.headers['set-cookie'] = [e, s]
    } else res.headers['set-cookie'] = s
  }
  res.cookie = res.setCookie
  return res
}
