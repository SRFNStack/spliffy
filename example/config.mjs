import helmet from 'helmet'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default () =>
  ({
    routeDir: path.join(__dirname, 'www'),
    port: 11420,
    staticContentTypes: {
      '.spliff': 'image/png'
    },
    logAccess: true,
    ignoreFilesMatching: ['^ignore', 'cantLoadThis'],
    decodeQueryParameters: true,
    middleware: [
      (req, res, next) => {
        res.headers['app-mw-applied'] = true
        console.log('Look at me! I\'m in the middle!')
        next()
      },
      helmet()
    ],
    nodeModuleRoutes: {
      nodeModulesPath: path.resolve(__dirname, '../node_modules'),
      files: [
        'cookie/index.js',
        {
          modulePath: 'etag/index.js',
          urlPath: '/etag.js'
        }
      ]
    },
    printRoutes: true,
    logLevel: 'DEBUG',
    notFoundRoute: '/404.html',
    resolveWithoutExtension: '.js',
    cacheStatic: false
  })
