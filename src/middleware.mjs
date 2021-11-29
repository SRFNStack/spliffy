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
  if (Array.isArray(middleware)) {
    validateMiddlewareArray(middleware)
  } else if (typeof middleware === 'object') {
    for (const method in middleware) {
      // ensure methods are always available as uppercase
      const upMethod = method.toUpperCase()
      middleware[upMethod] = middleware[method]
      validateMiddlewareArray(middleware[upMethod])
    }
  } else {
    throw new Error('Invalid middleware definition: ' + middleware)
  }
}

export const validateMiddlewareArray = (arr) => {
  if (!Array.isArray(arr)) {
    throw new Error('middleware must be an array of functions')
  }
  for (const f of arr) {
    if (typeof f !== 'function') {
      throw new Error('Each element in the array of middleware must be a function')
    }
  }
}

export async function invokeMiddleware (middleware, req, res, reqErr) {
  await new Promise((resolve, reject) => {
    let current = -1
    const next = (err) => {
      if (err) reject(err)
      if (res.writableEnded) {
        resolve()
        return
      }
      current++
      if (current === middleware.length) {
        resolve()
      } else {
        try {
          if (reqErr) middleware[current](reqErr, req, res, next)
          else middleware[current](req, res, next)
        } catch (e) {
          log.error('Middleware threw exception', e)
          reject(e)
        }
      }
    }

    next()
  })
}
