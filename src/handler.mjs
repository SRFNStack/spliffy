import log from './log.mjs'
import { deserializeBody, serializeBody } from './content.mjs'
import { invokeMiddleware, preProcessMiddleware } from './middleware.mjs'
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
    if (middleware) {
      await executeMiddleware(middleware, req, res, errorTransformer, refId, e)
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
  if (status === 500) {
    log.error(e)
  }
  end(res, status, null, e.body || '')
}

const end = (res, defaultStatusCode, statusCodeOverride, body) => {
  // status set directly on res wins
  res.statusCode = statusCodeOverride || res.statusCode || defaultStatusCode
  if (body instanceof Readable || res.streaming) {
    res.streaming = true
    if (body instanceof Readable) {
      pipeResponse(res, body)
    }
    // handler is responsible for ending the response if they are streaming
  } else {
    res.end(doSerializeBody(body, res) || '')
  }
}

const ipv6CompressRegex = /\b:?(?:0+:?){2,}/g

const compressIpv6 = ip => ip && ip.includes(':') ? ip.replaceAll(ipv6CompressRegex, '::') : ip

const writeAccess = function (req, res) {
  const start = Date.now()
  return () => {
    log.access(compressIpv6(req.remoteAddress), compressIpv6(res.proxiedRemoteAddress) || '', res.statusCode, req.method, req.url, Date.now() - start + 'ms')
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
  readStream.on('data', chunk => res.write(chunk))
    .on('end', () => res.end())
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

const handleRequest = async (req, res, handler, middleware, errorTransformer) => {
  try {
    let reqBody
    if (!handler.streamRequestBody) {
      if (req.method === 'GET' || req.method === 'HEAD') {
        reqBody = Promise.resolve(null)
      } else {
        let buffer
        reqBody = new Promise(
          resolve =>
            res.onData((data, isLast) => {
              const chunk = Buffer.concat([Buffer.from(data)])
              buffer = buffer ? Buffer.concat([buffer, chunk]) : chunk
              if (isLast) {
                resolve(buffer)
              }
            })
        )
      }
    } else {
      const readable = new Readable({
        read: () => {
        }
      })
      res.onData((data, isLast) => {
        if (data.byteLength > 0 || isLast) {
          readable.push(Buffer.concat([Buffer.from(data)]))
          if (isLast) {
            readable.push(null)
          }
        }
      })
      reqBody = Promise.resolve(readable)
    }
    if (middleware) {
      await executeMiddleware(middleware, req, res, errorTransformer)
    }
    if (!res.writableEnded && !res.ended) {
      await executeHandler(req.spliffyUrl, res, req, reqBody, handler, middleware, errorTransformer)
    }
  } catch (e) {
    const refId = uuid()
    if (middleware) {
      await executeMiddleware(middleware, req, res, errorTransformer, refId, e)
    }
    if (!res.writableEnded) { endError(res, e, refId, errorTransformer) }
  }
}

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'CONNECT', 'TRACE', 'WEBSOCKET']

let currentDate = new Date().toISOString()
setInterval(() => { currentDate = new Date().toISOString() }, 1000)

export const createHandler = (handler, middleware, pathParameters, config) => {
  const processedMiddleware = preProcessMiddleware(middleware)
  return function (res, req) {
    try {
      res.cork(() => {
        req = decorateRequest(req, pathParameters, res, config)
        res = decorateResponse(res, req, finalizeResponse, config.errorTransformer, endError, config)

        if (config.logAccess) {
          // pre-fetch IPs for logging while still safe
          req._ra = req.remoteAddress
          req._pra = req.proxiedRemoteAddress
          res.onEnd = writeAccess(req, res)
        }

        if (config.writeDateHeader) {
          res.headers.date = currentDate
        }

        handleRequest(req, res, handler, processedMiddleware, config.errorTransformer)
          .catch(e => {
            log.error('Failed handling request', e)
            if (!res.writableEnded) {
              res.statusCode = 500
              res.end()
            }
          })
      })
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
  const params = handler?.pathParameters || []
  return (res, req) => {
    try {
      res.cork(() => {
        req = decorateRequest(req, params, res, config)
        res = decorateResponse(res, req, finalizeResponse, config.errorTransformer, endError, config)
        if (config.logAccess) {
          req._ra = req.remoteAddress
          req._pra = req.proxiedRemoteAddress
          res.onEnd = writeAccess(req, res)
        }
        if (handler && typeof handler === 'object') {
          const processedMiddleware = preProcessMiddleware(handler.middleware)
          if (handler.handlers && typeof handler.handlers[req.method] === 'function') {
            const h = handler.handlers[req.method]
            if ('statusCodeOverride' in handler) {
              h.statusCodeOverride = handler.statusCodeOverride
            }
            handleRequest(req, res,
              h,
              processedMiddleware,
              config.errorTransformer
            ).catch((e) => {
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
      })
    } catch (e) {
      log.error('Failed handling request', e)
    }
  }
}
