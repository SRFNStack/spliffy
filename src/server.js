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
    return () => ( {
        headers: {
            allow: methods,
        },
        statusCode: 204
    } )
};

/**
 * Load the routes
 */
const start = config => {
    if( !state.initialized ) {
        state.initialized = true
        const routes = [...findRoutes( config ), ...getNodeModuleRoutes( config )]
        let app, port
        if( config.secure ) {
            app = getHttpsApp( config.secure )
            port = config.secure.port || 14420
            startHttpRedirect( config.host, config.port )
        } else {
            app = uws.App()
            port = config.port
        }
        for( let route of routes ) {
            if( config.printRoutes ) {
                log.info( 'Configured Route: ', route )
            }
            let routePattern = `^${route.urlPath.replace( /:[^/]+/g, "[^/]+" ).replace( /\*/g, ".*" )}$`
            if( config.notFoundRoute && config.notFoundRoute.match( routePattern ) ) {
                config.notFoundRouteHandler = route
                route.statusCodeOverride = 404
            }
            if( config.defaultRoute && config.defaultRoute.match( routePattern ) ) {
                config.defaultRouteHandler = route
            }
            for( let method in route.handlers ) {
                let theHandler = handler.create( route.handlers[method], route.middleware, route.pathParameters, config );
                app[appMethods[method]]( route.urlPath, theHandler )
                if( route.urlPath.endsWith( '/' ) && route.urlPath.length > 1 ) {
                    app[appMethods[method]]( route.urlPath.substr( 0, route.urlPath.length - 1 ), theHandler )
                }
                if( route.urlPath.endsWith( '/*') ) {
                    app[appMethods[method]]( route.urlPath.substr( 0, route.urlPath.length - 2 ), theHandler )
                }
            }
            if( !route.handlers.OPTIONS ) {
                app.options( route.urlPath, optionsHandler( Object.keys( route.handlers ).join( ', ' ) ) )
            }
        }

        if( config.notFoundRoute && !config.defaultRoute ) {
            log.warn( 'No route matched default route: ' + config.notFoundRoute )
        }
        app.any( '/*', handler.notFound( config ) )
        app.listen( config.host || '0.0.0.0', config.port, ( token ) => {
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
