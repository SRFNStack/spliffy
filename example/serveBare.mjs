// a second server with no middleware at all, so routes take the direct path
import spliffy, { moduleDirname } from '../src/index.mjs'
import path from 'path'

const dir = moduleDirname(import.meta.url)

spliffy({
  routeDir: path.join(dir, 'bare', 'www'),
  port: 11421,
  // the same routes over tls, the http port keeps serving instead of redirecting
  httpsPort: 11422,
  httpsKeyFile: path.join(dir, 'bare', 'certs', 'server.key'),
  httpsCertFile: path.join(dir, 'bare', 'certs', 'server.crt'),
  httpRedirect: false,
  logAccess: false,
  cacheStatic: true,
  staticPrecompressed: true,
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
