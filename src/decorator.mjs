import cookie from 'cookie'
import { parseQuery } from './url.mjs'
import { v4 as uuid } from 'uuid'
import stream from 'stream'
import { defaultStatusMessages } from './httpStatusCodes.mjs'

const { Writable } = stream

export class SpliffyRequest {
  constructor (uwsReq, paramToIndex, res, config) {
    this.init(uwsReq, paramToIndex, res, config)
  }

  init (uwsReq, paramToIndex, res, config, method, urlPath) {
    this.res = res
    this._uwsReq = uwsReq
    this._config = config
    this._paramToIndex = paramToIndex
    this.path = urlPath || (uwsReq ? uwsReq.getUrl() : '')
    this.method = method || (uwsReq ? uwsReq.getMethod().toUpperCase() : '')
    this._url = null
    this._headers = null
    this._spliffyUrl = null
    this._cookies = null
  }

  forceCache () {
    if (this._headers === null) this._cacheHeaders()
    if (this._spliffyUrl === null) this._cacheSpliffyUrl()
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
      const p2i = this._paramToIndex
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
    if (this._headers === null) this._cacheHeaders()
    return this._headers
  }

  get spliffyUrl () {
    if (this._spliffyUrl === null) this._cacheSpliffyUrl()
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

export function decorateRequest (uwsReq, paramToIndex, res, config) {
  return new SpliffyRequest(uwsReq, paramToIndex, res, config)
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
  redirect (c, l) {
    if (typeof c === 'string') { l = c; c = 301 }
    return this._finalizeResponse(this._sReq, this, { statusCode: c, headers: { location: l } })
  },
  send (b) { return this._finalizeResponse(this._sReq, this, b) },
  json (b) { return this._finalizeResponse(this._sReq, this, b) },
  setCookie (n, v, o) {
    const s = cookie.serialize(n, v, o)
    const e = this.headers['set-cookie']
    if (e) {
      if (Array.isArray(e)) e.push(s)
      else this.headers['set-cookie'] = [e, s]
    } else this.headers['set-cookie'] = s
  },
  cookie (n, v, o) { return this.setCookie(n, v, o) },
  flushHeaders (noCork) {
    if (this.headersSent) return
    this.headersSent = true
    const flush = () => {
      if (this.statusCode && this.statusCode !== 200) {
        this.writeStatus(this.statusCode + ' ' + (defaultStatusMessages[this.statusCode] || ''))
      }
      const headers = this.headers
      for (const h in headers) {
        const v = headers[h]
        if (Array.isArray(v)) {
          for (let i = 0, l = v.length; i < l; i++) this.writeHeader(h, String(v[i]))
        } else {
          this.writeHeader(h, String(v))
        }
      }
    }
    if (noCork) flush()
    else this.cork(flush)
  },
  ensureOnAborted () {
    if (this._onAbortedRegistered) return
    this._onAbortedRegistered = true
    this.onAborted(() => { this.ended = true; this.writableEnded = true; this.finalized = true })
  },
  write (chunk, encoding, cb) {
    this.ensureOnAborted()
    this.streaming = true
    return this.cork(() => {
      if (!this.headersSent) this.flushHeaders(true)
      const result = this._uwsWrite((chunk instanceof Buffer || chunk instanceof Uint8Array || typeof chunk === 'string') ? chunk : JSON.stringify(chunk))
      if (cb) cb()
      return result
    })
  },
  end (body) {
    if (this.ended) return
    this.ended = true
    this.writableEnded = true
    this.cork(() => {
      if (!this.headersSent) this.flushHeaders(true)
      this._uwsEnd(body || '')
    })
    if (this.onEnd) this.onEnd()
  },
  getWritable () {
    this.ensureOnAborted()
    if (!this.outStream) {
      this.streaming = true
      this.outStream = new Writable({ write: (c, e, callback) => { this.write(c, e, callback) } })
        .on('finish', () => this.end())
        .on('error', e => { try { this.outStream.destroy() } finally { this._endError(this, e, uuid(), this._errorTransformer) } })
    }
    return this.outStream
  }
}

export function decorateResponse (res, sReq, finalizeResponse, errorTransformer, endError, config) {
  res._sReq = sReq
  res._finalizeResponse = finalizeResponse
  res._errorTransformer = errorTransformer
  res._endError = endError
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
  res.redirect = resProto.redirect
  res.send = resProto.send
  res.json = resProto.json
  res.setCookie = resProto.setCookie
  res.cookie = resProto.cookie

  res._uwsWrite = res.write
  res.write = resProto.write

  res.getWritable = resProto.getWritable

  res._uwsEnd = res.end
  res.ended = false
  res.end = resProto.end

  return res
}
