import log from './log.mjs'
import { getNodeModuleRoutes } from './nodeModuleHandler.mjs'
import uws from 'uWebSockets.js'
import { createHandler, createNotFoundHandler } from './handler.mjs'
import { findRoutes } from './routes.mjs'
import { isDeclarative } from './declarative.mjs'
import { hasMiddleware } from './middleware.mjs'
import path from 'path'
import fs from 'fs'

const state = {
  routes: {},
  initialized: false
}
const appMethods = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'del',
  OPTIONS: 'options',
  HEAD: 'head',
  CONNECT: 'connect',
  TRACE: 'trace',
  WEBSOCKET: 'ws'
}
const optionsHandler = (config, middleware, methods) => {
  return createHandler(() => ({
    headers: {
      allow: methods
    },
    statusCode: 204
  }),
  middleware,
  [],
  config,
  null,
  'OPTIONS'
  )
}

const startHttpRedirect = (host, port, httpsPort) => {
  // redirect http to https
  uws.App().any('/*',
    (res, req) => {
      try {
        const hostHeader = req.getHeader('host').split(':')[0] || 'localhost'
        const query = req.getQuery()
        res.writeStatus('301 Moved Permanently')
          .writeHeader('location', `https://${hostHeader}:${httpsPort}${req.getUrl()}${query ? '?' + query : ''}`)
          .end()
      } catch (e) {
        log.error(`Failed to handle http request on port ${port}`, e)
      }
    }
  ).listen(host || '::', port, (token) => {
    if (token) {
      log.gne(`Http redirect server initialized at ${new Date().toISOString()} and listening on port ${port}`)
    } else {
      throw new Error(`Failed to start server on port ${port}`)
    }
  })
}

const getHttpsApp = (key, cert) => {
  const keyPath = path.resolve(key)
  const certPath = path.resolve(cert)
  if (!fs.existsSync(keyPath)) throw new Error(`Can't find https key file: ${keyPath}`)
  if (!fs.existsSync(certPath)) throw new Error(`Can't find https cert file: ${certPath}`)
  return uws.SSLApp({
    key_file_name: keyPath,
    cert_file_name: certPath
  })
}

const rejectDeclarative = (route, use) => {
  for (const method in route.handlers) {
    if (isDeclarative(route.handlers[method])) {
      throw new Error(`${route.filePath} is ${use} but ${method} is a declarative response, which cannot be reused for other paths`)
    }
  }
}

export async function startServer (config) {
  if (!state.initialized) {
    state.initialized = true
    const routes = [...getNodeModuleRoutes(config), ...(await findRoutes(config))]
    // every listener gets the same routes: https on httpsPort, and http on port unless it redirects
    const listeners = []
    if (config.httpsKeyFile) {
      listeners.push({ app: getHttpsApp(config.httpsKeyFile, config.httpsCertFile), port: config.httpsPort, name: 'https' })
      if (config.httpRedirect) {
        startHttpRedirect(config.host, config.port, config.httpsPort)
      } else {
        listeners.push({ app: uws.App(), port: config.port, name: 'http' })
      }
    } else {
      listeners.push({ app: uws.App(), port: config.port, name: 'http' })
    }
    // a declarative response is bytes uws keeps hold of, so each listener gets its own copy
    const register = (method, urlPath, handler) => {
      for (let i = 0; i < listeners.length; i++) {
        listeners[i].app[method](urlPath, i > 0 && handler instanceof ArrayBuffer ? handler.slice(0) : handler)
      }
    }

    for (const route of routes) {
      if (config.printRoutes) {
        log.info('Configured Route: ', route)
      }
      const routePattern = `^${route.urlPath.replace(/:[^/]+/g, '[^/]+').replace(/\*/g, '.*')}$`
      if (config.notFoundRoute && config.notFoundRoute.match(routePattern)) {
        rejectDeclarative(route, 'the not found route')
        config.notFoundRouteHandler = route
        route.statusCodeOverride = 404
      }
      if (config.defaultRoute && config.defaultRoute.match(routePattern)) {
        rejectDeclarative(route, 'the default route')
        config.defaultRouteHandler = route
      }
      let hadSlash = false
      if (route.urlPath.endsWith('/') && route.urlPath.length > 1) {
        hadSlash = true
        route.urlPath = route.urlPath.substring(0, route.urlPath.length - 1)
      }
      // a compiled copy of the handler can stand in when nothing has to run per request
      const compiled = (route.declarativeHandlers && !hasMiddleware(route.middleware) &&
        config.notFoundRouteHandler !== route && config.defaultRouteHandler !== route)
        ? route.declarativeHandlers
        : null
      for (const method in route.handlers) {
        let theHandler = null
        if (method === 'WEBSOCKET' || isDeclarative(route.handlers[method])) {
          theHandler = route.handlers[method]
        } else if (compiled && compiled[method]) {
          theHandler = compiled[method]
        } else {
          theHandler = createHandler(route.handlers[method], route.middleware, route.paramToIndex, config, route.urlPath, method)
        }
        register(appMethods[method], route.urlPath, theHandler)
        if (hadSlash && config.serveRoutesWithSlash) {
          register(appMethods[method], route.urlPath + '/', theHandler)
        }
        if (route.urlPath.endsWith('/*')) {
          register(appMethods[method], route.urlPath.substr(0, route.urlPath.length - 2), theHandler)
        }
      }
      if (config.autoOptions && !route.handlers.OPTIONS) {
        const theHandler = optionsHandler(config, route.middleware, Object.keys(route.handlers).join(', '))
        register('options', route.urlPath, theHandler)
        if (hadSlash && config.serveRoutesWithSlash) {
          register('options', route.urlPath + '/', theHandler)
        }
      }
    }

    if (config.notFoundRoute && !config.notFoundRouteHandler) {
      log.warn('No route matched not found route: ' + config.notFoundRoute)
    }
    if (config.defaultRoute && !config.defaultRouteHandler) {
      log.warn('No route matched default route: ' + config.defaultRoute)
    }

    const notFound = createNotFoundHandler(config)
    for (const { app, port, name } of listeners) {
      app.any('/*', notFound)
      app.listen(config.host || '::', port, (token) => {
        if (token) {
          log.gne(`Server initialized at ${new Date().toISOString()} and listening for ${name} on port ${port}`)
        } else {
          throw new Error(`Failed to start server on port ${port}`)
        }
      })
    }
    return listeners[0].app
  }
}
