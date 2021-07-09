const helmet = require( "helmet" );
module.exports = ( ) =>
    ( {
        routeDir: __dirname + '/www',
        port: 420,
        staticContentTypes: {
            '.spliff': 'image/png'
        },
        logAccess: true,
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
        resolveWithoutExtension: '.js',
        cacheStatic: true
    } )
