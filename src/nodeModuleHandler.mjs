import fs from 'fs'
import path from 'path'
import { mergeMiddleware } from './middleware.mjs'
import { createStaticHandler } from './staticHandler.mjs'
import { getContentTypeByExtension } from './content.mjs'

const stripLeadingSlash = p => p.startsWith('/') ? p.substr(1) : p

/**
 This helper will add all the configured node_module files to the given routes.
 The configured node moduleRoutes must be explicit files, no pattern matching is supported.
 Generating the list of files using pattern matching yourself is highly discouraged.
 It is much safer to explicitly list every file you wish to be served so you don't inadvertently serve additional files.

 The default method is to read and serve directly from the node_modules directory without copying.
 if method is set to "copy", files are copied from node_modules to their final location within the routes dir folder.

 The primary benefit of using this in copy mode is that the files will be automatically updated when the package version
 is updated, and it improves IDE integration by making the file really available after first run.

 This could be destructive if not configured correctly, hence the default of read only
 */
export function getNodeModuleRoutes (config) {
  const nodeModuleRoutes = config.nodeModuleRoutes
  const routes = []
  if (nodeModuleRoutes && typeof nodeModuleRoutes === 'object') {
    const nodeModulesDir = nodeModuleRoutes.nodeModulesPath ? path.resolve(nodeModuleRoutes.nodeModulesPath) : path.resolve(config.routeDir, '..', 'node_modules')
    if (!fs.existsSync(nodeModulesDir)) {
      throw new Error(`Unable to find node_modules dir at ${nodeModulesDir}`)
    }
    const prefix = stripLeadingSlash(nodeModuleRoutes.routePrefix || 'lib/ext')
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
        if (nodeModuleRoutes.method === 'copy') {
          const dest = path.join(config.routeDir, urlPath)
          fs.mkdirSync(path.dirname(dest), { recursive: true })
          fs.copyFileSync(filePath, dest)
        } else {
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
        }
      } else {
        console.warn(`The specified node_modules file: ${file} does not exist and will not be served.`)
      }
    }
  }
  return routes
}
