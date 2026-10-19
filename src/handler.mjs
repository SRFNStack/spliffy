import log from './log.mjs'
import { deserializeBody, serializeBody } from './content.mjs'
import { invokeMiddleware, preProcessMiddleware } from './middleware.mjs'
import { responseProto, decorateResponse, isDecorated, SpliffyRequest, HandlerContext, uwsCallback } from './decorator.mjs'
import { v4 as uuid } from 'uuid'
import { defaultStatusMessages } from './httpStatusCodes.mjs'
import stream from 'stream'
const { Readable } = stream

const NULL_PROMISE = Promise.resolve(null)
const EMPTY_BODY = Buffer.alloc(0)

/**
 * The context for a request without a body. The body is only deserialized when a handler asks
 * for it, which must happen before the handler first yields, same as the headers.
 */
class BodilessContext extends HandlerContext {
  constructor (req, res, acceptsDefault, decorate) {
    super(req, res, null, decorate)
    this._acceptsDefault = acceptsDefault
  }

  get body () {
    return this._body || (this._body = deserializeBody(EMPTY_BODY, this.req.headers['content-type'], this._acceptsDefault))
  }

  set body (b) { this._body = b }

  get bodyPromise () {
    return this._bodyPromise || (this._bodyPromise = Promise.resolve(this.body))
  }

  set bodyPromise (p) { this._bodyPromise = p }
}

const executeHandler = async (url, res, req, bodyPromise, handler, middleware, errorTransformer) => {
  try {
    const bodyContent = await (bodyPromise || NULL_PROMISE)
    if (!res.writableEnded) {
      const deserializedBody = (bodyContent instanceof Readable || !bodyContent)
        ? bodyContent
        : deserializeBody(bodyContent, req.headers['content-type'], res.acceptsDefault)

      const handled = await handler(new HandlerContext(req, res, Promise.resolve(deserializedBody), null, deserializedBody))
      finalizeResponse(req, res, handled, handler.statusCodeOverride)
    }
  } catch (e) {
    const refId = uuid()
    if (middleware) {
      try { await executeMiddleware(middleware, req, res, errorTransformer, refId, e) } catch (me) { log.error(me) }
    }
    endError(res, e, refId, errorTransformer)
  }
}

const endError = (res, e, refId, errorTransformer) => {
  if (e.body && typeof e.body !== 'string') {
    e.body = JSON.stringify(e.body)
  }
  if (typeof errorTransformer === 'function') {
    e = errorTransformer(e, refId)
  }
  res.headers['x-ref-id'] = refId
  const status = e.statusCode || 500
  if (status === 500) log.error(e)
  end(res, status, null, e.body || '')
}

const end = (res, defaultStatusCode, statusCodeOverride, body) => {
  res.statusCode = statusCodeOverride || res.statusCode || defaultStatusCode
  if (currentDate) res.setHeader('Date', currentDate)
  if (body instanceof Readable || res.streaming) {
    res.streaming = true
    if (body instanceof Readable) pipeResponse(res, body)
  } else {
    if (typeof body === 'string' || !body || body instanceof Buffer) {
      res.end(body || '')
    } else {
      res.end(doSerializeBody(body, res) || '')
    }
  }
}

const finalizeResponse = (req, res, handled, statusCodeOverride) => {
  if (res.finalized) return
  res.finalized = true

  if (typeof handled === 'string' || !handled || handled instanceof Buffer) {
    end(res, 200, statusCodeOverride, handled)
  } else if (handled.body || handled.statusMessage || handled.statusCode || handled.headers) {
    if (handled.headers) res.assignHeaders(handled.headers)
    if (handled.statusMessage) res.statusMessage = handled.statusMessage
    end(res, handled.statusCode || 200, statusCodeOverride, handled.body)
  } else {
    end(res, 200, statusCodeOverride, handled)
  }
}

const pipeResponse = (res, readStream, errorTransformer) => {
  // the response outlives the uws callback, so uws must be told what to do if the client goes away
  res.ensureOnAborted()
  readStream.on('data', chunk => res.write(chunk))
    .on('end', () => res.end())
    .on('error', e => {
      try { readStream.destroy() } finally { endError(res, e, uuid(), errorTransformer) }
    })
}

const doSerializeBody = (body, res) => {
  const contentType = res.getHeader('content-type')
  const serialized = serializeBody(body, contentType, res.acceptsDefault)
  if (serialized?.contentType && !contentType) {
    res.headers['content-type'] = serialized.contentType
  }
  return serialized?.data || ''
}

async function executeMiddleware (processedMiddleware, req, res, errorTransformer, refId, e) {
  if (!processedMiddleware) return
  const methodMiddleware = processedMiddleware[req.method]
  const allMiddleware = processedMiddleware.ALL
  if (e) {
    if (allMiddleware?.error) await invokeMiddleware(allMiddleware.error, req, res, e)
    if (methodMiddleware?.error) await invokeMiddleware(methodMiddleware.error, req, res, e)
  } else {
    if (allMiddleware?.normal) await invokeMiddleware(allMiddleware.normal, req, res)
    if (methodMiddleware?.normal) await invokeMiddleware(methodMiddleware.normal, req, res)
  }
}

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'CONNECT', 'TRACE', 'WEBSOCKET']

let currentDate = ''
let dateInterval = null

/**
 * Collect the request body, then resolve with it. Resolves with an empty Buffer when there is no body.
 */
const collectBody = (res) => new Promise(resolve => {
  let buffer = null
  res.onData((data, isLast) => {
    if (data.byteLength > 0) {
      const chunk = Buffer.concat([Buffer.from(data)])
      buffer = buffer ? Buffer.concat([buffer, chunk]) : chunk
    }
    if (isLast) resolve(buffer || EMPTY_BODY)
  })
})

const streamBody = (res) => {
  const readable = new Readable({ read () {} })
  res.onData((data, isLast) => {
    if (data.byteLength > 0 || isLast) {
      readable.push(Buffer.concat([Buffer.from(data)]))
      if (isLast) readable.push(null)
    }
  })
  return Promise.resolve(readable)
}

const handleRequest = async (sReq, res, handler, processedMiddleware, config) => {
  try {
    let reqBodyPromise = NULL_PROMISE
    if (sReq.method !== 'GET' && sReq.method !== 'HEAD') {
      reqBodyPromise = handler.streamRequestBody ? streamBody(res) : collectBody(res)
    }

    if (processedMiddleware) {
      await executeMiddleware(processedMiddleware, sReq, res, config.errorTransformer)
      if (!res.writableEnded && !res.ended) {
        await executeHandler(sReq.spliffyUrl, res, sReq, reqBodyPromise, handler, processedMiddleware, config.errorTransformer)
      }
    } else {
      await executeHandler(sReq.spliffyUrl, res, sReq, reqBodyPromise, handler, null, config.errorTransformer)
    }
  } catch (e) {
    const refId = uuid()
    if (processedMiddleware) {
      await executeMiddleware(processedMiddleware, sReq, res, config.errorTransformer, refId, e)
    }
    if (!res.writableEnded) { endError(res, e, refId, config.errorTransformer) }
  }
}

// a request without content-length or transfer-encoding has no body (rfc 7230 section 3.3), so there is
// nothing to wait for
const hasBody = req => {
  const contentLength = req.getHeader('content-length')
  return (contentLength !== '' && contentLength !== '0') || req.getHeader('transfer-encoding') !== ''
}

const fail = (res, e) => {
  log.error('Failed handling request', e)
  if (!res.writableEnded) {
    res.statusCode = 500
    res.end()
  }
}

// parked for the synchronous cork callbacks below, same trick as the response prototype uses
let corkedRes = null
let corkedEnd = null
let corkedBody = null
let corkedContentType = null
let corkedStatus = null
let corkedHeaders = null
const corkedTypedEnd = () => {
  corkedRes.writeHeader('content-type', corkedContentType)
  corkedEnd.call(corkedRes, corkedBody)
}
const corkedDescriptorEnd = () => {
  if (corkedStatus) corkedRes.writeStatus(corkedStatus)
  for (const name in corkedHeaders) {
    const value = corkedHeaders[name]
    if (Array.isArray(value)) {
      for (let i = 0, l = value.length; i < l; i++) corkedRes.writeHeader(name, String(value[i]))
    } else {
      corkedRes.writeHeader(name, String(value))
    }
  }
  corkedEnd.call(corkedRes, corkedBody)
}

/**
 * Send a { statusCode, statusMessage, headers, body } descriptor whose body is text with the uws
 * response as is: status, headers and body in one corked write.
 */
const sendDescriptor = (res, uwsEnd, handled) => {
  const statusCode = handled.statusCode
  corkedRes = res
  corkedEnd = uwsEnd
  corkedStatus = statusCode && statusCode !== 200 ? statusCode + ' ' + (handled.statusMessage || defaultStatusMessages[statusCode] || '') : null
  corkedHeaders = handled.headers
  corkedBody = handled.body || ''
  res.cork(corkedDescriptorEnd)
  corkedRes = corkedEnd = corkedStatus = corkedHeaders = corkedBody = null
}

/**
 * Create the uws handler for a route
 * @param handler The route handler function
 * @param middleware The middleware for the route
 * @param paramToIndex Map of path parameter name to uws parameter index
 * @param config The server config
 * @param urlPath The uws route pattern
 * @param method The upper case method the handler is registered for. uws only routes exact method
 * matches to it, so no request needs to ask.
 */
export const createHandler = (handler, middleware, paramToIndex, config, urlPath, method) => {
  const processedMiddleware = preProcessMiddleware(middleware)
  if (config.writeDateHeader && !dateInterval) {
    currentDate = new Date().toUTCString()
    dateInterval = setInterval(() => { currentDate = new Date().toUTCString() }, 1000)
  }

  // wildcard routes read the url from the request, static routes already know it
  const staticPath = urlPath?.indexOf('*') > -1 ? null : urlPath
  // without middleware or body streaming the handler can be called directly from the uws callback
  const direct = !processedMiddleware && !handler.streamRequestBody
  const noBody = method === 'GET' || method === 'HEAD'
  const errorTransformer = config.errorTransformer
  const acceptsDefault = config.acceptsDefault
  // the raw uws end of the last response seen: http and https responses have different prototypes
  let rawProto = null
  let uwsEnd = null

  // turn the uws response into a spliffy response, once
  const decorate = res => {
    if (isDecorated(res)) return res
    Object.setPrototypeOf(res, responseProto(res, config, finalizeResponse, endError))
    return res
  }

  // call the handler and send whatever it returns
  const invoke = (res, context) => {
    let handled
    try {
      handled = handler(context)
    } catch (e) {
      endError(decorate(res), e, uuid(), errorTransformer)
      return
    }
    if (handled instanceof Promise) {
      // the uws request dies when this callback returns, read everything the handler may still want
      context.req.forceCache()
      decorate(res).ensureOnAborted()
      handled.then(h => finalizeResponse(null, res, h, handler.statusCodeOverride))
        .catch(e => endError(res, e, uuid(), errorTransformer))
    } else if (!isDecorated(res) && !handler.statusCodeOverride && !currentDate) {
      // the handler never touched the response, so the answer is a single uws call
      const proto = Object.getPrototypeOf(res)
      if (proto !== rawProto) {
        rawProto = proto
        uwsEnd = proto.end
      }
      if (typeof handled === 'string' || handled instanceof Buffer) {
        uwsEnd.call(res, handled)
      } else if (!handled) {
        uwsEnd.call(res, '')
      } else if (handled instanceof Readable) {
        finalizeResponse(null, decorate(res), handled, null)
      } else if (handled.body || handled.statusMessage || handled.statusCode || handled.headers) {
        const body = handled.body
        if ((typeof body === 'string' || body instanceof Buffer || !body) && !(body instanceof Readable)) {
          sendDescriptor(res, uwsEnd, handled)
        } else {
          finalizeResponse(null, decorate(res), handled, null)
        }
      } else {
        const serialized = serializeBody(handled, undefined, acceptsDefault)
        if (serialized?.contentType) {
          corkedRes = res
          corkedEnd = uwsEnd
          corkedBody = serialized.data || ''
          corkedContentType = serialized.contentType
          res.cork(corkedTypedEnd)
          corkedRes = corkedEnd = corkedBody = corkedContentType = null
        } else {
          uwsEnd.call(res, serialized?.data || '')
        }
      }
    } else {
      finalizeResponse(null, decorate(res), handled, handler.statusCodeOverride)
    }
  }

  return function (res, req) {
    uwsCallback.active = true
    try {
      if (direct && noBody) {
        // no body to wait for: the request is only read while the uws request is still valid
        const sReq = new SpliffyRequest(req, paramToIndex, res, config, method, staticPath, decorate)
        invoke(res, new HandlerContext(sReq, res, NULL_PROMISE, decorate, null))
      } else if (direct) {
        // the uws request is gone by the time the body arrives, so read it all now
        const sReq = new SpliffyRequest(req, paramToIndex, res, config, method, staticPath, decorate)
        if (!hasBody(req)) {
          // nothing to wait for, so the handler runs now while the uws request is still readable
          invoke(res, new BodilessContext(sReq, res, acceptsDefault, decorate))
          return
        }
        sReq.forceCache()
        decorate(res)
        res.ensureOnAborted()
        let buffer = null
        res.onData((data, isLast) => {
          if (data.byteLength > 0) {
            const chunk = Buffer.concat([Buffer.from(data)])
            buffer = buffer ? Buffer.concat([buffer, chunk]) : chunk
          }
          if (!isLast || res.ended) return
          uwsCallback.active = true
          try {
            const body = deserializeBody(buffer || EMPTY_BODY, sReq.headers['content-type'], acceptsDefault)
            invoke(res, new HandlerContext(sReq, res, Promise.resolve(body), decorate, body))
          } catch (e) {
            endError(res, e, uuid(), errorTransformer)
          } finally {
            uwsCallback.active = false
          }
        })
      } else {
        const sReq = new SpliffyRequest(req, paramToIndex, res, config, method, staticPath, decorate)
        sReq.forceCache()
        decorate(res)
        res.ensureOnAborted()
        handleRequest(sReq, res, handler, processedMiddleware, config).catch(e => fail(res, e))
      }
    } catch (e) {
      fail(res, e)
    } finally {
      uwsCallback.active = false
    }
  }
}

// true when the last path segment looks like a file name, /app.js or /logo.png but not /.well-known/x
const hasExtension = urlPath => urlPath.lastIndexOf('.') > urlPath.lastIndexOf('/') + 1

const ignoredByDefaultRoute = (urlPath, ignore) => {
  for (const entry of ignore) {
    if (typeof entry === 'string' ? urlPath.startsWith(entry) : entry.test(urlPath)) return true
  }
  return false
}

export const createNotFoundHandler = config => {
  const defaultRoute = config.defaultRouteHandler || null
  const notFoundRoute = config.notFoundRouteHandler || null
  const ignore = config.defaultRouteIgnore || []
  // the default route is the SPA shell, it only answers requests a browser navigation would make
  const pickHandler = sReq => {
    if (defaultRoute && (sReq.method === 'GET' || sReq.method === 'HEAD') &&
      !hasExtension(sReq.path) && !ignoredByDefaultRoute(sReq.path, ignore)) {
      return defaultRoute
    }
    return notFoundRoute
  }
  return (res, req) => {
    uwsCallback.active = true
    try {
      decorateResponse(res, config, finalizeResponse, endError)
      const sReq = new SpliffyRequest(req, {}, res, config)
      const handler = pickHandler(sReq)
      if (handler) sReq._paramToIndex = handler.paramToIndex || {}
      sReq.forceCache()
      res.ensureOnAborted()
      if (handler && typeof handler === 'object') {
        const processedMiddleware = preProcessMiddleware(handler.middleware)
        if (handler.handlers && typeof handler.handlers[sReq.method] === 'function') {
          const h = handler.handlers[sReq.method]
          if ('statusCodeOverride' in handler) {
            h.statusCodeOverride = handler.statusCodeOverride
          }
          handleRequest(sReq, res, h, processedMiddleware, config)
            .catch(e => {
              log.error('Unexpected exception during request handling', e)
              if (!res.writableEnded) {
                res.statusCode = 500
                res.end()
              }
            })
        } else {
          res.statusCode = 404
          res.end()
        }
      } else {
        res.statusCode = 404
        res.end()
      }
    } catch (e) {
      log.error('Failed handling request', e)
    } finally {
      uwsCallback.active = false
    }
  }
}
