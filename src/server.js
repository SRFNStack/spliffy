const serverConfig = require( './serverConfig' )
const log = require( './log' )
const { getNodeModuleRoutes } = require( "./nodeModuleHandler" );
const uws = require( 'uWebSockets.js' )
const handler = require( './handler' )
const { findRoutes } = require( './routes' )
const { getHttpsApp, startHttpRedirect } = require( './secure' )

const state = {
    routes: {},
    initialized: false
}
const appMethods = {
    GET: 'get',
    POST: 'post',
    PUT: 'put',
    PATCH: 'patch',
    DELETE: 'del',
    OPTIONS: 'options',
    HEAD: 'head',
    CONNECT: 'connect',
    TRACE: 'trace'
}

function addRoutesToApp( app, routes ) {
    for( let route of [...routes, ...getNodeModuleRoutes()] ) {
        for( let method in route.handlers ) {
            app[appMethods[method]]( route.urlPath, handler.create( route.handlers[method] ) )
        }
        if( !route.handlers.OPTIONS ) {
            let optionsHandler = methods => {
                return ( res ) => {
                    res.setHeader( 'Allow', methods )
                    res.writeStatus( '204' )
                    res.end()
                }
            };
            app.options( route.urlPath, optionsHandler( Object.keys( route.handlers ).join( ', ' ) ) )
        }
    }
}

/**
 * Load the routes
 */
const create = () => {
    if( !state.initialized ) {
        state.initialized = true
        const routes = findRoutes()
        return {
            start() {
                let app, port
                if( serverConfig.current.secure ) {
                    app = getHttpsApp( serverConfig.current.secure )
                    port = serverConfig.current.secure.port || 14420
                    addRoutesToApp( app, routes )
                    startHttpRedirect()
                } else {
                    app = uws.App()
                    port = serverConfig.current.port
                    addRoutesToApp( app, routes )
                }
                app.listen( serverConfig.current.host || '0.0.0.0', serverConfig.current.port, ( token ) => {
                    if( token ) {
                        log.gne( `Server initialized at ${new Date().toISOString()} and listening on port ${port}` )
                    } else {
                        throw new Error( `Failed to start server on port ${port}` )
                    }
                } )
            }
        }
    }

}
module.exports = {
    create
}
