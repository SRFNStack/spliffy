// a second server with no middleware at all, so routes take the direct path
import spliffy, { moduleDirname } from '../src/index.mjs'
import path from 'path'

spliffy({
  routeDir: path.join(moduleDirname(import.meta.url), 'bare', 'www'),
  port: 11421,
  logAccess: false,
  cacheStatic: true,
  declarativeStaticMaxSize: 1024 * 1024,
  staticContentTypes: {
    '.txt': 'text/plain'
  },
  defaultRoute: '/app.html',
  defaultRouteIgnore: ['/api', /^\/internal\//],
  notFoundRoute: '/404.txt',
  // no nodeModulesPath, the project's node_modules is three directories up from routeDir
  nodeModuleRoutes: {
    files: ['cookie/dist/index.js', { modulePath: 'etag/index.js', urlPath: '/etag.js' }]
  }
})
