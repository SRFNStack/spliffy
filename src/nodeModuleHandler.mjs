import fs from 'fs'
import path from 'path'
import { mergeMiddleware } from './middleware.mjs'
import { createStaticHandler } from './staticHandler.mjs'
import { getContentTypeByExtension } from './content.mjs'

const stripLeadingSlash = p => p.startsWith('/') ? p.substr(1) : p

// every node_modules dir from routeDir up to the filesystem root, the directories node itself searches
const ancestorNodeModules = routeDir => {
  const dirs = []
  let dir = path.resolve(routeDir)
  while (true) {
    dirs.push(path.join(dir, 'node_modules'))
    const parent = path.dirname(dir)
    if (parent === dir) return dirs
    dir = parent
  }
}

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
    let searchDirs
    if (nodeModuleRoutes.nodeModulesPath) {
      searchDirs = [path.resolve(nodeModuleRoutes.nodeModulesPath)]
      if (!fs.existsSync(searchDirs[0])) {
        throw new Error(`Unable to find node_modules dir at ${searchDirs[0]}`)
      }
    } else {
      searchDirs = ancestorNodeModules(config.routeDir).filter(dir => fs.existsSync(dir))
      if (searchDirs.length === 0) {
        throw new Error(`Unable to find a node_modules dir in ${config.routeDir} or any parent directory`)
      }
    }
    // the first node_modules dir holding the file wins, nearest to routeDir first
    const findFile = modulePath => {
      for (const dir of searchDirs) {
        const filePath = path.join(dir, modulePath)
        if (fs.existsSync(filePath)) return filePath
      }
      return null
    }
    const prefix = stripLeadingSlash(nodeModuleRoutes.routePrefix || 'lib/ext')
    if (!Array.isArray(nodeModuleRoutes.files)) {
      nodeModuleRoutes.files = [nodeModuleRoutes.files]
    }
    for (const file of nodeModuleRoutes.files) {
      let filePath, urlPath
      if (file && typeof file === 'object') {
        filePath = findFile(file.modulePath)
        urlPath = `/${prefix}/${stripLeadingSlash(file.urlPath || file.modulePath)}`
      } else if (file && typeof file === 'string') {
        filePath = findFile(file)
        urlPath = `/${prefix}/${stripLeadingSlash(file)}`
      } else {
        throw new Error('Invalid node_module file: ' + file)
      }

      if (filePath) {
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
              config.cacheStatic, config.staticCacheControl, config.staticPrecompressed
            ),
            middleware: mw
          })
        }
      } else {
        console.warn(`The specified node_modules file: ${JSON.stringify(file)} was not found in ${searchDirs.join(', ')} and will not be served.`)
      }
    }
  }
  return routes
}
