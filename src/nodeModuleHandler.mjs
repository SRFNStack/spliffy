import fs from 'fs'
import path from 'path'
import { mergeMiddleware } from './middleware.mjs'
import { createStaticHandler } from './staticHandler.mjs'
import { getContentTypeByExtension } from './content.mjs'

const stripLeadingSlash = p => p.startsWith('/') ? p.substr(1) : p

/**
 This method will add all of the configured node_module files to the given routes.
 The configured node moduleRoutes must be explicit files, no pattern matching is supported.
 Generating the list of files using pattern matching yourself is highly discouraged.
 It is much safer to explicitly list every file you wish to be served so you don't inadvertently serve additional files.
 */
export function getNodeModuleRoutes (config) {
  const nodeModuleRoutes = config.nodeModuleRoutes
  const routes = []
  if (nodeModuleRoutes && typeof nodeModuleRoutes === 'object') {
    const nodeModulesDir = nodeModuleRoutes.nodeModulesPath ? path.resolve(nodeModuleRoutes.nodeModulesPath) : path.resolve(config.routeDir, '..', 'node_modules')
    if (!fs.existsSync(nodeModulesDir)) {
      throw new Error(`Unable to find node_modules dir at ${nodeModulesDir}`)
    }
    const prefix = stripLeadingSlash(nodeModuleRoutes.routePrefix || 'lib')
    if (!Array.isArray(nodeModuleRoutes.files)) {
      nodeModuleRoutes.files = [nodeModuleRoutes.files]
    }
    for (const file of nodeModuleRoutes.files) {
      let filePath, urlPath
      if (file && typeof file === 'object') {
        filePath = path.join(nodeModulesDir, file.modulePath)
        urlPath = `/${prefix}/${stripLeadingSlash(file.urlPath || file.modulePath)}`
      } else if (file && typeof file === 'string') {
        filePath = path.join(nodeModulesDir, file)
        urlPath = `/${prefix}/${stripLeadingSlash(file)}`
      } else {
        throw new Error('Invalid node_module file: ' + file)
      }

      if (fs.existsSync(filePath)) {
        const parts = urlPath.split('/')
        const lastPart = parts.pop()
        const mw = {}
        mergeMiddleware(config.middleware, mw)
        mergeMiddleware(nodeModuleRoutes.middleware || {}, mw)
        routes.push({
          pathParameters: [],
          urlPath,
          filePath,
          handlers: createStaticHandler(
            filePath, getContentTypeByExtension(lastPart, config.staticContentTypes),
            config.cacheStatic, config.staticCacheControl
          ),
          middleware: mw
        })
      } else {
        console.warn(`The specified node_modules file: ${file} does not exist and will not be served.`)
      }
    }
  }
  return routes
}
