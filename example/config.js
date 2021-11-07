const helmet = require( "helmet" );
module.exports = ( ) =>
    ( {
        routeDir: __dirname + '/www',
        port: 11420,
        staticContentTypes: {
            '.spliff': 'image/png'
        },
        logAccess: true,
        ignoreFilesMatching: ['^ignore', 'cantLoadThis'],
        decodeQueryParameters: true,
        middleware: [
            ( req, res, next ) => {
                console.log( "Look at me! I'm in the middle!" )
                next()
            },
            helmet()
        ],
        nodeModuleRoutes:{
            nodeModulesPath: require('path').resolve(__dirname, '..', 'node_modules'),
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
    } )
