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
const optionsHandler = methods => {
    return ( res ) => {
        res.headers['allow'] = methods
        res.writeStatus( '204' )
        res.end()
    }
};

/**
 * Load the routes
 */
const start = () => {
    if( !state.initialized ) {
        state.initialized = true
        const routes = [...findRoutes(), ...getNodeModuleRoutes()]
        let app, port
        if( serverConfig.current.secure ) {
            app = getHttpsApp()
            port = serverConfig.current.secure.port || 14420
            startHttpRedirect()
        } else {
            app = uws.App()
            port = serverConfig.current.port
        }
        for( let route of routes ) {
            if( serverConfig.current.printRoutes ) {
                log.info( 'Configured Route: ', route )
            }
            let routePattern = `^${route.urlPath.replace(/:[^/]+/g, "[^/]+").replace(/\*/g, ".*")}$`
            if(serverConfig.current.notFoundRoute && serverConfig.current.notFoundRoute.match(routePattern)){
                serverConfig.current.defaultRoute = route
            }
            for( let method in route.handlers ) {
                let theHandler = handler.create( route.handlers[method], route.middleware, route.pathParameters );
                app[appMethods[method]]( route.urlPath, theHandler )
                if( route.urlPath.endsWith( '/' ) && route.urlPath.length > 1 ) {
                    app[appMethods[method]]( route.urlPath.substr(0,route.urlPath.length-1), theHandler )
                }
            }
            if( !route.handlers.OPTIONS ) {
                app.options( route.urlPath, optionsHandler( Object.keys( route.handlers ).join( ', ' ) ) )
            }
        }

        if(serverConfig.current.notFoundRoute && !serverConfig.current.defaultRoute) {
            log.warn('No route matched default route: '+serverConfig.current.notFoundRoute)
        }
        app.any( '/*', handler.notFound )
        app.listen( serverConfig.current.host || '0.0.0.0', serverConfig.current.port, ( token ) => {
            if( token ) {
                log.gne( `Server initialized at ${new Date().toISOString()} and listening on port ${port}` )
            } else {
                throw new Error( `Failed to start server on port ${port}` )
            }
        } )
    }
}
module.exports = {
    start
}
