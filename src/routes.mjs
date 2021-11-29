import { validateMiddleware, mergeMiddleware } from './middleware.mjs'
import { createStaticHandler } from './staticHandler.mjs'
import { getContentTypeByExtension } from './content.mjs'
import fs from 'fs'
import path from 'path'
import { HTTP_METHODS } from './handler.mjs'
import util from 'util'

const { promisify } = util

const readdir = promisify(fs.readdir)

const isVariable = part => part.startsWith('$')
const getVariableName = part => part.substr(1)
const getPathPart = name => {
  if (name === 'index') {
    return ''
  }
  if (name.startsWith('$')) {
    return `:${name.substr(1)}`
  } else if (name.endsWith('+')) {
    return `${name.substr(0, name.length - 1)}/*`
  } else {
    return name
  }
}
const filterTestFiles = config => f => (!f.name.endsWith('.test.js') && !f.name.endsWith('.test.mjs')) || config.allowTestFileRoutes
const filterIgnoredFiles = config => f => !config.ignoreFilesMatching.filter(p => p).find(pattern => f.name.match(pattern))
const ignoreHandlerFields = { middleware: true, streamRequestBody: true }
const doFindRoutes = async (config, currentFile, filePath, urlPath, pathParameters, inheritedMiddleware) => {
  const routes = []
  const name = currentFile.name
  if (currentFile.isDirectory()) {
    routes.push(...(await findRoutesInDir(name, filePath, urlPath, inheritedMiddleware, pathParameters, config)))
  } else if (!config.staticMode && (name.endsWith('.rt.js') || name.endsWith('.rt.mjs'))) {
    routes.push(await buildJSHandlerRoute(name, filePath, urlPath, inheritedMiddleware, pathParameters))
  } else {
    routes.push(...buildStaticRoutes(name, filePath, urlPath, inheritedMiddleware, pathParameters, config))
  }
  return routes
}

const importModules = async (config, dirPath, files) => Promise.all(
  files
    .filter(filterTestFiles(config))
    .filter(filterIgnoredFiles(config))
    .map(f => path.join(dirPath, f.name))
    .map(mwPath => import(`file://${mwPath}`)
      .then(module => ({ module, mwPath }))
    ))

const findRoutesInDir = async (name, filePath, urlPath, inheritedMiddleware, pathParameters, config) => {
  if (isVariable(name)) {
    pathParameters = pathParameters.concat(getVariableName(name))
  }
  const files = await readdir(filePath, { withFileTypes: true })

  const middlewareModules = await importModules(config, filePath,
    files.filter(f => f.name.endsWith('.mw.js') || f.name.endsWith('.mw.mjs'))
  )
  const dirMiddleware = middlewareModules.map(({ module, mwPath }) => {
    const middleware = module.middleware || module.default?.middleware
    if (!middleware) {
      throw new Error(`${mwPath} must export a middleware property or have a middleware property on the default export`)
    }
    try {
      validateMiddleware(middleware)
    } catch (e) {
      throw new Error('Failed to load middleware in file ' + mwPath + '\n' + e.message + '\n' + e.stack)
    }
    return middleware
  })
    .reduce((result, incoming) => mergeMiddleware(incoming, result), inheritedMiddleware)

  return Promise.all(files
    .filter(f => !f.name.endsWith('.mw.js') && !f.name.endsWith('.mw.mjs'))
    .filter(filterTestFiles(config))
    .filter(filterIgnoredFiles(config))
    .map(
      (f) => doFindRoutes(
        config,
        f,
        path.join(filePath, f.name),
        urlPath + '/' + getPathPart(name),
        pathParameters,
        dirMiddleware
      )
    ))
    .then(routes => routes.flat())
}

const buildJSHandlerRoute = async (name, filePath, urlPath, inheritedMiddleware, pathParameters) => {
  if (name.endsWith('.mjs')) {
    name = name.substr(0, name.length - '.rt.mjs'.length)
  } else {
    name = name.substr(0, name.length - '.rt.js'.length)
  }
  if (isVariable(name)) {
    pathParameters = pathParameters.concat(getVariableName(name))
  }
  const route = {
    pathParameters,
    urlPath: `${urlPath}/${getPathPart(name)}`,
    filePath,
    handlers: {}
  }
  const module = await import(`file://${filePath}`)
  const handlers = module.default

  route.middleware = mergeMiddleware(handlers.middleware || [], inheritedMiddleware)
  for (const method of Object.keys(handlers).filter(k => !ignoreHandlerFields[k])) {
    if (HTTP_METHODS.indexOf(method) === -1) {
      throw new Error(`Method: ${method} in file ${filePath} is not a valid http method. It must be one of: ${HTTP_METHODS}. Method names must be all uppercase.`)
    }
    const loadedHandler = handlers[method]
    let handler = loadedHandler
    if (typeof loadedHandler.handler === 'function') {
      handler = loadedHandler.handler
    }
    if (typeof handler !== 'function') {
      throw new Error(`Request method ${method} in file ${filePath} must be a function. Got: ${handlers[method]}`)
    }
    if (!('streamRequestBody' in loadedHandler)) {
      handler.streamRequestBody = handlers.streamRequestBody
    } else {
      handler.streamRequestBody = loadedHandler.streamRequestBody
    }
    route.handlers[method] = handler
  }
  return route
}

const buildStaticRoutes = (name, filePath, urlPath, inheritedMiddleware, pathParameters, config) => {
  const routes = []
  if (isVariable(name)) {
    pathParameters = pathParameters.concat(getVariableName(name))
  }
  const contentType = getContentTypeByExtension(name, config.staticContentTypes)
  const route = {
    pathParameters,
    urlPath: `${urlPath}/${getPathPart(name)}`,
    filePath,
    handlers: createStaticHandler(filePath, contentType, config.cacheStatic, config.staticCacheControl),
    middleware: inheritedMiddleware
  }

  routes.push(route)

  for (const ext of config.resolveWithoutExtension) {
    if (name.endsWith(ext)) {
      const strippedName = name.substr(0, name.length - ext.length)
      // in the index case we need to add both the stripped and an empty path so it will resolve the parent
      if (strippedName === 'index') {
        const noExtRoute = Object.assign({}, route)
        noExtRoute.urlPath = `${urlPath}/${strippedName}`
        routes.push(noExtRoute)
      }
      const noExtRoute = Object.assign({}, route)
      noExtRoute.urlPath = `${urlPath}/${getPathPart(strippedName)}`
      routes.push(noExtRoute)
    }
  }
  return routes
}

export async function findRoutes (config) {
  const fullRouteDir = path.resolve(config.routeDir)
  if (!fs.existsSync(fullRouteDir)) {
    throw new Error(`can't find route directory: ${fullRouteDir}`)
  }
  const appMiddleware = mergeMiddleware(config.middleware || [], {})
  const files = await readdir(fullRouteDir, { withFileTypes: true })
  return Promise.all(files
    .filter(filterTestFiles(config))
    .filter(filterIgnoredFiles(config))
    .map(
      f => doFindRoutes(config, f, path.join(fullRouteDir, f.name), '', [], appMiddleware)
    ))
    .then(routes => routes.flat())
}
