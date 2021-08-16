const fs = require( 'fs' )
const path = require( 'path' )
const { mergeMiddleware } = require( "./middleware" );
const staticHandler = require( './staticHandler' )
const { getContentTypeByExtension } = require( './content' )

const stripLeadingSlash = p => p.startsWith( '/' ) ? p.substr( 1 ) : p

module.exports = {
    /**
     This method will add all of the configured node_module files to the given routes.
     The configured node moduleRoutes must be explicit files, no pattern matching is supported.
     Generating the list of files using pattern matching yourself is highly discouraged.
     It is much safer to explicitly list every file you wish to be served so you don't inadvertently serve additional files.
     */
    getNodeModuleRoutes(config) {
        let nodeModuleRoutes = config.nodeModuleRoutes;
        let routes = []
        if( nodeModuleRoutes && typeof nodeModuleRoutes === 'object' ) {
            const nodeModulesDir = nodeModuleRoutes.nodeModulesPath ? path.resolve( nodeModuleRoutes.nodeModulesPath ) : path.resolve( config.routeDir, '..', 'node_modules' )
            if( !fs.existsSync( nodeModulesDir ) ) {
                throw new Error( `Unable to find node_modules dir at ${nodeModulesDir}` )
            }
            let prefix = stripLeadingSlash(nodeModuleRoutes.routePrefix || 'lib')
            if( !Array.isArray( nodeModuleRoutes.files ) ) {
                nodeModuleRoutes.files = [nodeModuleRoutes.files]
            }
            for( let file of nodeModuleRoutes.files ) {
                let filePath, urlPath
                if( file && typeof file === 'object' ) {
                    filePath = path.join( nodeModulesDir, file.modulePath )
                    urlPath = `/${prefix}/${stripLeadingSlash( file.urlPath || file.modulePath )}`
                } else if( file && typeof file === 'string' ) {
                    filePath = path.join( nodeModulesDir, file )
                    urlPath = `/${prefix}/${stripLeadingSlash( file )}`
                } else {
                    throw new Error( 'Invalid node_module file: ' + file )
                }

                if( fs.existsSync( filePath ) ) {
                    let parts = urlPath.split( '/' )
                    let lastPart = parts.pop()
                    let mw = {}
                    mergeMiddleware( config.middleware, mw )
                    mergeMiddleware( nodeModuleRoutes.middleware || {}, mw )
                    routes.push( {
                        pathParameters: [],
                        urlPath,
                        filePath,
                        handlers: staticHandler.create(
                            filePath, getContentTypeByExtension(lastPart, config.staticContentTypes),
                            config.cacheStatic, config.staticCacheControl
                        ),
                        middleware: mw
                    } )
                } else {
                    console.warn( `The specified node_modules file: ${file} does not exist and will not be served.` )
                }
            }
        }
        return routes
    }
}