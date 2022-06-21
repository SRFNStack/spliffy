import log from './log.mjs'
import { deserializeBody, serializeBody } from './content.mjs'
import { invokeMiddleware } from './middleware.mjs'
import { decorateResponse, decorateRequest } from './decorator.mjs'
import { v4 as uuid } from 'uuid'
import stream from 'stream'
const { Readable } = stream

/**
 * Execute the handler
 * @param url The url being requested
 * @param res The uws response object
 * @param req The uws request object
 * @param bodyPromise The request body promise
 * @param handler The handler function for the route
 * @param middleware The middleware that applies to this request
 * @param errorTransformer An errorTransformer to convert error objects into response data
 */
const executeHandler = async (url, res, req, bodyPromise, handler, middleware, errorTransformer) => {
  try {
    bodyPromise = bodyPromise.then(bodyContent => {
      if (bodyContent instanceof Readable) return bodyContent
      if (res.writableEnded) return
      return deserializeBody(bodyContent, req.headers['content-type'], res.acceptsDefault)
    })
  } catch (e) {
    log.error('Failed to parse request.', e)
    end(res, 400, handler.statusCodeOverride)
    return
  }

  try {
    const handled = await handler({ url, bodyPromise, headers: req.headers, req, res })
    finalizeResponse(req, res, handled, handler.statusCodeOverride)
  } catch (e) {
    const refId = uuid()
    await executeMiddleware(middleware, req, res, errorTransformer, refId, e)
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
  end(res, e.statusCode || 500, null, e.body || '')
}

const end = (res, defaultStatusCode, statusCodeOverride, body) => {
  // status set directly on res wins
  res.statusCode = statusCodeOverride || res.statusCode || defaultStatusCode
  if (body instanceof Readable || res.streaming) {
    res.streaming = true
    if (body instanceof Readable) {
      res.flushHeaders()
      pipeResponse(res, body)
    }
    // handler is responsible for ending the response if they are streaming
  } else {
    res.end(doSerializeBody(body, res) || '')
  }
}

const writeAccess = function (req, res) {
  const start = new Date().getTime()
  return () => {
    log.access(req.remoteAddress, res.proxiedRemoteAddress || '', res.statusCode, req.method, req.url, new Date().getTime() - start + 'ms')
  }
}

const finalizeResponse = (req, res, handled, statusCodeOverride) => {
  if (!res.finalized) {
    if (!handled) {
      // if no error was thrown, assume everything is fine. Otherwise each handler must return truthy which is un-necessary for methods that don't need to return anything
      end(res, 200, statusCodeOverride)
    } else {
      // if the returned object has known fields, treat it as a response object instead of the body
      if (handled.body || handled.statusMessage || handled.statusCode || handled.headers) {
        if (handled.headers) {
          res.assignHeaders(handled.headers)
        }
        res.statusMessage = handled.statusMessage || res.statusMessage
        end(res, handled.statusCode || 200, statusCodeOverride, handled.body)
      } else {
        end(res, 200, statusCodeOverride, handled)
      }
    }
    res.finalized = true
  }
}

const pipeResponse = (res, readStream, errorTransformer) => {
  readStream.on('data', res.write)
    .on('end', res.end)
    .on('error', e => {
      try {
        readStream.destroy()
      } finally {
        endError(res, e, uuid(), errorTransformer)
      }
    })
}

const doSerializeBody = (body, res) => {
  if (!body || typeof body === 'string' || body instanceof Readable) {
    return body
  }
  const contentType = res.getHeader('content-type')
  const serialized = serializeBody(body, contentType, res.acceptsDefault)

  if (serialized?.contentType && !contentType) {
    res.headers['content-type'] = serialized.contentType
  }
  return serialized?.data || ''
}

async function executeMiddleware (middleware, req, res, errorTransformer, refId, e) {
  if (!middleware) return

  let applicableMiddleware = middleware[req.method]
  if (middleware.ALL) {
    if (applicableMiddleware) applicableMiddleware = middleware.ALL.concat(applicableMiddleware)
    else applicableMiddleware = middleware.ALL
  }

  if (!applicableMiddleware || applicableMiddleware.length === 0) {
    return
  }
  if (e) {
    await invokeMiddleware(applicableMiddleware.filter(mw => mw.length === 4), req, res, e)
  } else {
    await invokeMiddleware(applicableMiddleware.filter(mw => mw.length === 3), req, res)
  }
}

const handleRequest = async (req, res, handler, middleware, errorTransformer) => {
  try {
    let reqBody
    if (!handler.streamRequestBody) {
      let buffer
      reqBody = new Promise(
        resolve =>
          res.onData(async (data, isLast) => {
            if (isLast) {
              buffer = data.byteLength > 0 ? Buffer.concat([buffer, Buffer.from(data)].filter(b => b)) : buffer
              resolve(buffer)
            }
            buffer = Buffer.concat([buffer, Buffer.from(data)].filter(b => b))
          })
      )
    } else {
      const readable = new Readable({
        read: () => {
        }
      })
      res.onData(async (data, isLast) => {
        if (data.byteLength === 0 && !isLast) return
        // data must be copied so it isn't lost
        readable.push(Buffer.concat([Buffer.from(data)]))
        if (isLast) {
          readable.push(null)
        }
      })
      reqBody = Promise.resolve(readable)
    }
    await executeMiddleware(middleware, req, res, errorTransformer)
    if (!res.writableEnded && !res.ended) {
      await executeHandler(req.spliffyUrl, res, req, reqBody, handler, middleware, errorTransformer)
    }
  } catch (e) {
    const refId = uuid()
    await executeMiddleware(middleware, req, res, errorTransformer, refId, e)
    if (!res.writableEnded) { endError(res, e, refId, errorTransformer) }
  }
}

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'CONNECT', 'TRACE']

let currentDate = new Date().toISOString()
setInterval(() => { currentDate = new Date().toISOString() }, 1000)

export const createHandler = (handler, middleware, pathParameters, config) => function (res, req) {
  try {
    req = decorateRequest(req, pathParameters, res, config)
    res = decorateResponse(res, req, finalizeResponse, config.errorTransformer, endError, config)

    if (config.logAccess) {
      res.onEnd = writeAccess(req, res)
    }

    if (config.writeDateHeader) {
      res.headers.date = currentDate
    }

    handleRequest(req, res, handler, middleware, config.errorTransformer)
      .catch(e => {
        log.error('Failed handling request', e)
        res.statusCode = 500
        res.end()
      })
  } catch (e) {
    log.error('Failed handling request', e)
    res.statusCode = 500
    res.end()
  }
}

export const createNotFoundHandler = config => {
  const handler = config.defaultRouteHandler || config.notFoundRouteHandler
  const params = handler?.pathParameters || []
  return (res, req) => {
    try {
      req = decorateRequest(req, params, res, config)
      res = decorateResponse(res, req, finalizeResponse, config.errorTransformer, endError, config)
      if (config.logAccess) {
        res.onEnd = writeAccess(req, res)
      }
      if (handler && typeof handler === 'object') {
        if (handler.handlers && typeof handler.handlers[req.method] === 'function') {
          if ('statusCodeOverride' in handler) {
            handler.handlers[req.method].statusCodeOverride = handler.statusCodeOverride
          }
          handleRequest(req, res,
            handler.handlers[req.method],
            handler.middleware,
            config.errorTransformer
          ).catch((e) => {
            log.error('Unexpected exception during request handling', e)
            res.statusCode = 500
          })
        } else {
          res.statusCode = 405
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
