import cookie from 'cookie'
import { parseQuery } from './url.mjs'
import { v4 as uuid } from 'uuid'
import stream from 'stream'
import { defaultStatusMessages } from './httpStatusCodes.mjs'

const { Writable } = stream

export class SpliffyRequest {
  /**
   * @param uwsReq The uws request. Only valid until the uws handler returns, see forceCache
   * @param paramToIndex Map of path parameter name to uws parameter index
   * @param res The response
   * @param config The server config
   * @param method The upper case request method, read from uwsReq when omitted
   * @param urlPath The static route path, read from uwsReq when omitted (wildcard routes)
   */
  constructor (uwsReq, paramToIndex, res, config, method, urlPath, decorate) {
    this._res = res
    this._decorate = decorate || null
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

  /**
   * Read everything from the uws request now. The uws request is only valid while the uws handler
   * is on the stack, so anything that outlives it (promises, body callbacks) must call this first.
   */
  forceCache () {
    if (this._headers === null) this._cacheHeaders()
    if (this._spliffyUrl === null) this._cacheSpliffyUrl()
    this._spliffyUrl._readQueryString()
    if (this._url === null) this._cacheUrl()
  }

  _cacheHeaders () {
    if (this._headers === null) {
      const headers = {}
      this._uwsReq.forEach((header, value) => { headers[header] = value })
      this._headers = headers
    }
  }

  _cacheUrl () {
    const q = this._uwsReq.getQuery()
    this._url = q ? `${this.path}?${q}` : this.path
  }

  _cacheSpliffyUrl () {
    if (this._spliffyUrl === null) {
      const p2i = this._paramToIndex
      let params = null
      for (const name in p2i) {
        if (params === null) params = {}
        params[name] = this._uwsReq.getParameter(p2i[name])
      }
      this._spliffyUrl = new SpliffyUrl(this.path, this._uwsReq, params, this._config.decodeQueryParameters)
    }
  }

  get url () {
    if (this._url === null) this._cacheUrl()
    return this._url
  }

  /**
   * The response, decorated on first access so a handler that never asks for it never pays for it
   */
  get res () { return this._decorate === null ? this._res : this._decorate(this._res) }
  set res (r) { this._res = r }

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
    const val = Buffer.from(this._res.getRemoteAddressAsText()).toString()
    Object.defineProperty(this, 'remoteAddress', { value: val, enumerable: true })
    return val
  }

  get proxiedRemoteAddress () {
    const val = Buffer.from(this._res.getProxiedRemoteAddressAsText()).toString()
    Object.defineProperty(this, 'proxiedRemoteAddress', { value: val, enumerable: true })
    return val
  }

  get (header) { return this.headers[header.toLowerCase()] }
}

/**
 * The url passed to handlers. The query string is only read from the uws request when something
 * asks for it, or when the request is cached because the handler outlives the uws request.
 */
export class SpliffyUrl {
  constructor (path, uwsReq, params, decodeQueryParameters) {
    this.path = path
    this._uwsReq = uwsReq
    this._queryString = null
    this._query = null
    this._decode = decodeQueryParameters
    // a closure rather than a method so handlers can destructure it: ({ url: { param } }) => param('id')
    this.param = params === null ? noParam : name => params[name]
  }

  _readQueryString () {
    if (this._queryString === null) this._queryString = this._uwsReq.getQuery()
  }

  get query () {
    if (this._query === null) {
      this._readQueryString()
      this._query = (this._queryString && parseQuery(this._queryString, this._decode)) || {}
    }
    return this._query
  }

  set query (q) { this._query = q }

  toJSON () { return { path: this.path, query: this.query } }
}

const noParam = () => undefined

export function decorateRequest (uwsReq, paramToIndex, res, config) {
  return new SpliffyRequest(uwsReq, paramToIndex, res, config)
}

/**
 * The first argument passed to route handlers. url, headers and cookies are read lazily so a
 * handler that never looks at them never pays for parsing them.
 */
export class HandlerContext {
  constructor (req, res, bodyPromise, decorate) {
    this.req = req
    this._res = res
    this._decorate = decorate || null
    this.bodyPromise = bodyPromise
  }

  get res () { return this._decorate === null ? this._res : this._decorate(this._res) }
  set res (r) { this._res = r }
  get url () { return this.req.spliffyUrl }
  get headers () { return this.req.headers }
  get cookies () { return this.req.cookies }
}

/**
 * Everything spliffy adds to the uws response lives on a prototype that sits between the response
 * and the uws prototype, so decorating a response is a single prototype swap instead of a property
 * write per method. Per request state (headers, ended, statusCode...) defaults live here too and
 * are only written to the instance when they change.
 */
/**
 * uws corks the socket for as long as one of its callbacks runs (the route handler, onData), so a
 * write made there goes out with everything else written in the callback. A write made later, after
 * an await or from a stream event, has to cork itself. The handlers flip this while a callback runs.
 */
export const uwsCallback = { active: false }

// uws runs the cork callback synchronously and without arguments, so what it needs is parked here
// for the duration of the call instead of allocating a closure per response
let corked = null
let corkedBody = null
let corkedCallback = null
const corkedWriteHead = () => corked._writeHead()
const corkedEnd = () => {
  corked.flushHeaders(true)
  corked._uwsEnd(corkedBody)
}
const corkedWrite = () => {
  if (!corked.headersSent) corked.flushHeaders(true)
  corked._uwsWrite(corkedBody)
  if (corkedCallback) corkedCallback()
}

const buildResponseProto = (uwsProto, config, finalizeResponse, endError) => {
  const proto = Object.create(uwsProto)
  Object.defineProperties(proto, Object.getOwnPropertyDescriptors({
    _uwsEnd: uwsProto.end,
    _uwsWrite: uwsProto.write,
    acceptsDefault: config.acceptsDefault,
    _errorTransformer: config.errorTransformer,
    _finalizeResponse: finalizeResponse,
    _endError: endError,

    // per request state defaults
    _h: null,
    statusCode: undefined,
    statusMessage: undefined,
    headersSent: false,
    ended: false,
    writableEnded: false,
    finalized: false,
    streaming: false,
    outStream: null,
    onEnd: null,
    _onAbortedRegistered: false,

    get headers () { return this._h || (this._h = {}) },
    set headers (v) { this._h = v },
    setHeader (h, v) { this.headers[h.toLowerCase()] = v },
    removeHeader (h) { if (this._h) delete this._h[h.toLowerCase()] },
    assignHeaders (headers) {
      const h = this.headers
      for (const k in headers) { h[k.toLowerCase()] = headers[k] }
    },
    getHeader (h) { return this._h ? this._h[h.toLowerCase()] : undefined },
    status (c) { this.statusCode = c; return this },
    writeHead (s, h) { this.statusCode = s; if (h) this.assignHeaders(h) },
    redirect (c, l) {
      if (typeof c === 'string') { l = c; c = 301 }
      return this._finalizeResponse(null, this, { statusCode: c, headers: { location: l } })
    },
    send (b) { return this._finalizeResponse(null, this, b) },
    json (b) { return this._finalizeResponse(null, this, b) },
    setCookie (n, v, o) {
      const s = cookie.serialize(n, v, o)
      const headers = this.headers
      const e = headers['set-cookie']
      if (e) {
        if (Array.isArray(e)) e.push(s)
        else headers['set-cookie'] = [e, s]
      } else headers['set-cookie'] = s
    },
    cookie (n, v, o) { return this.setCookie(n, v, o) },
    _writeHead () {
      const code = this.statusCode
      if (code && code !== 200) {
        this.writeStatus(code + ' ' + (this.statusMessage || defaultStatusMessages[code] || ''))
      }
      const headers = this._h
      if (!headers) return
      for (const h in headers) {
        const v = headers[h]
        if (Array.isArray(v)) {
          for (let i = 0, l = v.length; i < l; i++) this.writeHeader(h, String(v[i]))
        } else {
          this.writeHeader(h, String(v))
        }
      }
    },
    flushHeaders (noCork) {
      if (this.headersSent) return
      this.headersSent = true
      if (noCork) {
        this._writeHead()
      } else {
        corked = this
        this.cork(corkedWriteHead)
        corked = null
      }
    },
    ensureOnAborted () {
      if (this._onAbortedRegistered) return
      this._onAbortedRegistered = true
      this.onAborted(() => { this.ended = true; this.writableEnded = true; this.finalized = true })
    },
    write (chunk, encoding, cb) {
      this.ensureOnAborted()
      this.streaming = true
      corked = this
      corkedBody = (chunk instanceof Buffer || chunk instanceof Uint8Array || typeof chunk === 'string') ? chunk : JSON.stringify(chunk)
      corkedCallback = cb || null
      const result = this.cork(corkedWrite)
      corked = corkedBody = corkedCallback = null
      return result
    },
    end (body) {
      if (this.ended) return
      this.ended = true
      this.writableEnded = true
      if (uwsCallback.active && (this.headersSent || (!this._h && (!this.statusCode || this.statusCode === 200)))) {
        // nothing to write ahead of the body and uws has the socket corked already, so one uws end
        // call sends status, headers and body in a single write
        this.headersSent = true
        this._uwsEnd(body || '')
      } else {
        // status and headers go out with the body in one write
        corked = this
        corkedBody = body || ''
        this.cork(corkedEnd)
        corked = corkedBody = null
      }
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
  }))
  proto[SPLIFFY_PROTO] = true
  return proto
}

const protoCache = new WeakMap()
const SPLIFFY_PROTO = Symbol('spliffyResponseProto')

/**
 * Get the spliffy response prototype for the given uws response. Built once per uws prototype and
 * config, then reused for every request.
 */
export function responseProto (res, config, finalizeResponse, endError) {
  const uwsProto = Object.getPrototypeOf(res)
  if (uwsProto[SPLIFFY_PROTO]) return uwsProto
  let byUwsProto = protoCache.get(config)
  if (!byUwsProto) protoCache.set(config, (byUwsProto = new Map()))
  let proto = byUwsProto.get(uwsProto)
  if (!proto) {
    proto = buildResponseProto(uwsProto, config, finalizeResponse, endError)
    byUwsProto.set(uwsProto, proto)
  }
  return proto
}

/**
 * Turn a uws response into a spliffy response.
 */
export function decorateResponse (res, config, finalizeResponse, endError) {
  Object.setPrototypeOf(res, responseProto(res, config, finalizeResponse, endError))
  return res
}
