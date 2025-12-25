import log from './log.mjs'
/**
 * middleware is stored as an object where the properties are request methods the middleware applies to
 * if a middleware applies to all methods, the property ALL is used
 * example:
 * {
 *     GET: [(req,res,next)=>console.log('ice cream man')]
 *     POST: [(req,res,next)=>console.log('gelato')]
 *     ALL: [(req,res,next)=>console.log('bruce banner')]
 * }
 */
export const mergeMiddleware = (incoming, existing) => {
  const mergeInto = cloneMiddleware(existing)

  validateMiddleware(incoming)
  if (Array.isArray(incoming)) {
    mergeInto.ALL = (existing.ALL || []).concat(incoming)
  } else if (typeof incoming === 'object') {
    for (const method in incoming) {
      const upMethod = method.toUpperCase()
      mergeInto[upMethod] = (mergeInto[method] || []).concat(incoming[upMethod] || [])
    }
  }
  return mergeInto
}

export const cloneMiddleware = (middleware) => {
  const clone = { ...middleware }
  for (const method in middleware) {
    clone[method] = [...(middleware[method] || [])]
  }
  return clone
}

/**
 * Ensure the given middleware is valid
 * @param middleware
 */
export const validateMiddleware = (middleware) => {
  if (!Array.isArray(middleware) && typeof middleware === 'object') {
    for (const method in middleware) {
      // ensure methods are always available as uppercase
      const upMethod = method.toUpperCase()
      middleware[upMethod] = middleware[method]
      validateMiddlewareArray(middleware[upMethod])
    }
  } else {
    validateMiddlewareArray(middleware)
  }
}

export const validateMiddlewareArray = (arr) => {
  if (!arr) return
  if (!Array.isArray(arr)) {
    throw new Error('middleware must be an array of functions')
  }
  for (const f of arr) {
    if (typeof f !== 'function') {
      throw new Error('Each element in the array of middleware must be a function')
    }
  }
}

export function preProcessMiddleware (middleware) {
  if (!middleware) return null
  const processed = {}
  let hasAny = false
  for (const method in middleware) {
    const list = middleware[method]
    if (list && list.length > 0) {
      processed[method] = {
        normal: list.filter(mw => mw.length <= 3),
        error: list.filter(mw => mw.length === 4)
      }
      hasAny = true
    }
  }
  return hasAny ? processed : null
}

export async function invokeMiddleware (middleware, req, res, reqErr) {
  if (!middleware || middleware.length === 0) return
  return new Promise((resolve, reject) => {
    let current = 0
    const next = (err) => {
      if (err) return reject(err)
      if (res.writableEnded || current === middleware.length) {
        return resolve()
      }
      const mw = middleware[current++]
      try {
        if (reqErr) mw(reqErr, req, res, next)
        else mw(req, res, next)
      } catch (e) {
        log.error('Middleware threw exception', e)
        reject(e)
      }
    }

    next()
  })
}
