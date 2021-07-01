const fs = require( 'fs' )
const path = require( 'path' )
const serverConfig = require( './serverConfig' )
const { mergeMiddleware } = require( "./middleware" );
const { addStaticRoute } = require( "./routeUtil" );


const stripLeadingSlash = p => p.startsWith( '/' ) ? p.substr( 1 ) : p
// const nmr = {
//     //uses routeDir/../node_modules by default
//     nodeModulesPath,
//     routePrefix,
// }
module.exports = {
    async addNodeModuleRoutes( routes ) {
        let nodeModuleRoutes = serverConfig.current.nodeModuleRoutes;
        if( nodeModuleRoutes && typeof nodeModuleRoutes === 'object' ) {
            const nodeModulesDir = path.resolve( nodeModuleRoutes.nodeModulesPath ) || path.resolve( serverConfig.current.routeDir, '..', 'node_modules' )
            if( !fs.existsSync( nodeModulesDir ) ) {
                throw new Error( `Unable to find node_modules dir at ${nodeModulesDir}` )
            }
            let prefix = nodeModuleRoutes.routePrefix || 'lib'
            if( !Array.isArray( nodeModuleRoutes.files ) ) {
                nodeModuleRoutes.files = [nodeModuleRoutes.files]
            }
            for( let file of nodeModuleRoutes.files ) {
                let filePath, urlPath
                if( file && typeof file === 'object' ) {
                    filePath = path.join( nodeModulesDir, file.modulePath )
                    urlPath = `${prefix}/${stripLeadingSlash( file.urlPath || file.modulePath )}`
                } else if( file && typeof file === 'string' ) {
                    filePath = path.join( nodeModulesDir, file )
                    urlPath = `${prefix}/${stripLeadingSlash( file )}`
                } else {
                    throw new Error( 'Invalid node_module file: ' + file )
                }

                if( fs.existsSync( filePath ) ) {
                    let parts = urlPath.split( '/' )
                    let lastPart = parts.pop()
                    let parent = parts.reduce( ( rts, part ) => rts[part] || ( rts[part] = {} ), routes )
                    let mw = {}
                    mergeMiddleware( serverConfig.current.middleware, mw )
                    mergeMiddleware( nodeModuleRoutes.middleware || {}, mw )
                    await addStaticRoute( parent, { name: lastPart }, filePath, mw )
                } else {
                    console.warn( `The specified node_modules file: ${file} does not exist and will not be served.` )
                }
            }
        }
    }
}