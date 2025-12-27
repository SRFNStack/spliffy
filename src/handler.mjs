import log from './log.mjs'
import { deserializeBody, serializeBody } from './content.mjs'
import { invokeMiddleware, preProcessMiddleware } from './middleware.mjs'
import { decorateResponse, SpliffyRequest } from './decorator.mjs'
import { v4 as uuid } from 'uuid'
import stream from 'stream'
const { Readable } = stream

const NULL_PROMISE = Promise.resolve(null)

const executeHandler = async (url, res, req, bodyPromise, handler, middleware, errorTransformer) => {
  try {
    const bodyContent = await (bodyPromise || NULL_PROMISE)
    if (!res.writableEnded) {
      const deserializedBody = (bodyContent instanceof Readable || !bodyContent)
        ? bodyContent
        : deserializeBody(bodyContent, req.headers['content-type'], res.acceptsDefault)

      const handled = await handler({ url, bodyPromise: Promise.resolve(deserializedBody), headers: req.headers, req, res })
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
  readStream.on('data', chunk => res.write(chunk))
    .on('end', () => res.end())
    .on('error', e => {
      try { readStream.destroy() } finally { endError(res, e, uuid(), errorTransformer) }
    })
}

const doSerializeBody = (body, res) => {
  const contentType = res.headers['content-type']
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

const handleRequest = async (sReq, res, handler, processedMiddleware, config) => {
  try {
    let reqBodyPromise = NULL_PROMISE
    if (sReq.method !== 'GET' && sReq.method !== 'HEAD') {
      if (handler.streamRequestBody) {
        const readable = new Readable({ read () {} })
        reqBodyPromise = Promise.resolve(readable)
        res.onData((data, isLast) => {
          if (data.byteLength > 0 || isLast) {
            readable.push(Buffer.concat([Buffer.from(data)]))
            if (isLast) readable.push(null)
          }
        })
      } else {
        reqBodyPromise = new Promise(resolve => res.onData((data, isLast) => {
          const chunk = Buffer.concat([Buffer.from(data)])
          res._buffer = res._buffer ? Buffer.concat([res._buffer, chunk]) : chunk
          if (isLast) resolve(res._buffer)
        }))
      }
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

export const createHandler = (handler, middleware, paramToIndex, config, urlPath) => {
  const processedMiddleware = preProcessMiddleware(middleware)
  if (config.writeDateHeader && !dateInterval) {
    currentDate = new Date().toUTCString()
    dateInterval = setInterval(() => { currentDate = new Date().toUTCString() }, 1000)
  }

  const isWildcardPath = urlPath?.indexOf('*') > -1

  // Pre-allocated request object for sync path
  const syncSReq = new SpliffyRequest(null, paramToIndex, null, config)
  const syncContext = {
    get url () { return syncSReq.spliffyUrl },
    bodyPromise: NULL_PROMISE,
    get headers () { return syncSReq.headers },
    req: syncSReq,
    res: null
  }

  return function (res, req) {
    try {
      const rawMethod = req.getMethod()
      if (!processedMiddleware && !handler.streamRequestBody && (rawMethod === 'get' || rawMethod === 'head')) {
        // HYPER FAST PATH
        const method = rawMethod === 'get' ? 'GET' : 'HEAD'
        syncSReq.init(req, paramToIndex, res, config, method, isWildcardPath ? null : urlPath)
        syncContext.res = res
        decorateResponse(res, syncSReq, finalizeResponse, config.errorTransformer, endError, config)
        const handled = handler(syncContext)
        if (handled instanceof Promise) {
          syncSReq.forceCache()
          res.ensureOnAborted()
          handled.then(h => finalizeResponse(syncSReq, res, h, handler.statusCodeOverride))
            .catch(e => endError(res, e, uuid(), config.errorTransformer))
        } else if (typeof handled === 'string' || handled instanceof Buffer) {
          end(res, 200, handler.statusCodeOverride, handled)
        } else {
          finalizeResponse(syncSReq, res, handled, handler.statusCodeOverride)
        }
      } else {
        const sReq = new SpliffyRequest(req, paramToIndex, res, config)
        sReq.forceCache()
        decorateResponse(res, sReq, finalizeResponse, config.errorTransformer, endError, config)
        res.ensureOnAborted()

        handleRequest(sReq, res, handler, processedMiddleware, config)
          .catch(e => {
            log.error('Failed handling request', e)
            if (!res.writableEnded) {
              res.statusCode = 500
              res.end()
            }
          })
      }
    } catch (e) {
      log.error('Failed handling request', e)
      if (!res.writableEnded) {
        res.statusCode = 500
        res.end()
      }
    }
  }
}

export const createNotFoundHandler = config => {
  const handler = config.defaultRouteHandler || config.notFoundRouteHandler
  const paramToIndex = handler?.paramToIndex || {}
  return (res, req) => {
    try {
      const sReq = new SpliffyRequest(req, paramToIndex, res, config)
      sReq.forceCache()
      decorateResponse(res, sReq, finalizeResponse, config.errorTransformer, endError, config)
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
    }
  }
}
