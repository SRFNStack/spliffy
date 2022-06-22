import log from './log.mjs'
import { getNodeModuleRoutes } from './nodeModuleHandler.mjs'
import uws from 'uWebSockets.js'
import { createHandler, createNotFoundHandler } from './handler.mjs'
import { findRoutes } from './routes.mjs'
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
  TRACE: 'trace'
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
  config
  )
}

const startHttpRedirect = (host, port) => {
  // redirect http to https
  uws.App().any('/*',
    (req, res) => {
      try {
        res.writeHead(301, { Location: `https://${req.headers.host}:${port}${req.url}` })
        res.end()
      } catch (e) {
        log.error(`Failed to handle http request on port ${port}`, req.url, e)
      }
    }
  ).listen(host || '0.0.0.0', port, (token) => {
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
  if (!fs.existsSync(certPath)) throw new Error(`Can't find https cert file: ${keyPath}`)
  return uws.App({
    key_file_name: keyPath,
    cert_file_name: certPath
  })
}

export async function startServer (config) {
  if (!state.initialized) {
    state.initialized = true
    const routes = [...getNodeModuleRoutes(config), ...(await findRoutes(config))]
    let app, port
    if (config.httpsKeyFile) {
      app = getHttpsApp(config.secure)
      port = config.secure.port || 14420
      startHttpRedirect(config.host, config.port || 10420)
    } else {
      app = uws.App()
      port = config.port || 10420
    }

    for (const route of routes) {
      if (config.printRoutes) {
        log.info('Configured Route: ', route)
      }
      const routePattern = `^${route.urlPath.replace(/:[^/]+/g, '[^/]+').replace(/\*/g, '.*')}$`
      if (config.notFoundRoute && config.notFoundRoute.match(routePattern)) {
        config.notFoundRouteHandler = route
        route.statusCodeOverride = 404
      }
      if (config.defaultRoute && config.defaultRoute.match(routePattern)) {
        config.defaultRouteHandler = route
      }
      for (const method in route.handlers) {
        const theHandler = createHandler(route.handlers[method], route.middleware, route.pathParameters, config)
        app[appMethods[method]](route.urlPath, theHandler)
        if (route.urlPath.endsWith('/') && route.urlPath.length > 1) {
          app[appMethods[method]](route.urlPath.substr(0, route.urlPath.length - 1), theHandler)
        }
        if (route.urlPath.endsWith('/*')) {
          app[appMethods[method]](route.urlPath.substr(0, route.urlPath.length - 2), theHandler)
        }
      }
      if (!route.handlers.OPTIONS) {
        app.options(route.urlPath, optionsHandler(config, route.middleware, Object.keys(route.handlers).join(', ')))
      }
    }

    if (config.notFoundRoute && !config.notFoundRouteHandler) {
      log.warn('No route matched not found route: ' + config.notFoundRoute)
    }
    if (config.defaultRoute && !config.defaultRouteHandler) {
      log.warn('No route matched default route: ' + config.notFoundRoute)
    }

    app.any('/*', createNotFoundHandler(config))
    app.listen(config.host || '0.0.0.0', config.port, (token) => {
      if (token) {
        log.gne(`Server initialized at ${new Date().toISOString()} and listening on port ${port}`)
      } else {
        throw new Error(`Failed to start server on port ${port}`)
      }
    })
    return app
  }
}
