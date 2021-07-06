const fs = require( 'fs' )
const path = require( 'path' )
const serverConfig = require( './serverConfig' )
const log = require( './log' )
const { validateMiddleware, mergeMiddleware } = require( "./middleware" );
const { getNewRouteData, addRoute, addStaticRoute } = require( "./routeUtil" );
const { addNodeModuleRoutes } = require( "./nodeModuleHandler" );
const state = {
    routes: {},
    initializing: false,
    hasPendingFsEvent: false
}
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'CONNECT', 'TRACE']

/**
 * Recursively walk the specified directory to discover all of the routes and middleware
 * @param currentFile The file or directory to search for routes
 * @param path The full path to the current file
 * @param inheritedMiddleware Middleware that is inherited from the app or parent routes
 * @returns {Promise<{} | Promise<(Promise<(Promise<T | never>|{})[] | never>|{})[] | never>>}
 */
const findRoutes = async ( currentFile, path, inheritedMiddleware ) => {
    let routes = {}
    if( currentFile.isDirectory() ) {

        let routeData = getNewRouteData( currentFile.name, routes )
        const files = fs.readdirSync( path, { withFileTypes: true } )

        const routeMiddleware = files
            .filter( f => f.name.endsWith( '.mw.js' ) )
            .map( f => {
                let exports = require( path + '/' + f.name )
                if( !exports.middleware ) {
                    throw new Error( '.mw.js files must export a middleware property' )
                }
                validateMiddleware( exports.middleware )
                return exports.middleware
            } )
            .reduce( ( result, incoming ) => mergeMiddleware( incoming, result ), inheritedMiddleware )

        return Promise.all( files
            .filter( f => !f.name.endsWith( '.mw.js' ) )
            .map(
                ( f ) => findRoutes( f, path + '/' + f.name, routeMiddleware )
            )
        )
            .then(
                routes => ( {
                    [routeData.name]: routes.reduce(
                        ( res, route ) => {
                            for( let name of Object.keys( route ) ) {
                                if( res[name] ) {
                                    throw `Duplicate route name ${name} found in path: ${path}`
                                }
                            }
                            return Object.assign( res, route )
                        },
                        routeData.route
                    )
                } )
            )
    } else if( !serverConfig.current.staticMode && currentFile.name.endsWith( '.rt.js' ) ) {
        addRoute( routes, path, currentFile.name.substr( 0, currentFile.name.length - '.rt.js'.length ), buildRoute( {}, path, inheritedMiddleware ) )
    } else {
        await addStaticRoute( routes, currentFile, path, inheritedMiddleware )
    }
    return routes
}


/**
 * load and gather data about the specified route handler file
 * @param route The initialized route data
 * @param path The full path to the file
 * @param inheritedMiddleware The inherited middleware
 * @returns {*}
 */
const buildRoute = ( route, path, inheritedMiddleware ) => {
    let handlers = require( path )

    route.handler = {}
    route.middleware = mergeMiddleware( handlers.middleware || [], inheritedMiddleware )
    //remove the middleware property if it was set so validation can still pass and to ensure we don't make bogus handlers
    delete handlers.middleware
    for( let method in handlers ) {
        if( HTTP_METHODS.indexOf( method ) === -1 ) {
            throw `Method: ${method} in file ${path} is not a valid http method. It must be one of: ${HTTP_METHODS}. Method names must be all uppercase.`
        }
        let handler = handlers[method]
        if( typeof handler !== 'function' ) {
            throw `Request method ${method} must be a function. Got: ${handlers[method]}`
        }
        route.handler[method] = handler
    }

    return route
}

/**
 * Load the routes
 */
const init = async () => {
    if( !state.initializing ) {
        state.initializing = true
        const fullRouteDir = path.resolve( serverConfig.current.routeDir )
        if( !fs.existsSync( fullRouteDir ) ) {
            throw `can't find route directory: ${fullRouteDir}`
        }
        let appMiddleware = mergeMiddleware( serverConfig.current.middleware || [], {} )
        return Promise.all(
            fs.readdirSync( fullRouteDir, { withFileTypes: true } )
                .map(
                    ( f ) => findRoutes( f, fullRouteDir + '/' + f.name, appMiddleware )
                )
        ).then(
            routes => {
                state.initializing = false
                state.routes = routes.reduce(
                    ( res, route ) => {
                        for( let name of Object.keys( route ) ) {
                            if( res[name] ) {
                                throw `Duplicate route name ${name} found in path: ${fullRouteDir}`
                            }
                        }
                        return Object.assign( res, route )
                    }, {} )
                return state.routes
            }
        ).then( addNodeModuleRoutes )
    }

}

module.exports = {
    init,
    HTTP_METHODS,
    validateMiddleware,
    /**
     * Find a handler for the given url
     * @param url
     * @returns {{}|{handler: ({}|{GET}|*|{GET}), pathParameters}}
     */
    find: ( url ) => {
        let prefix = serverConfig.current.routePrefix
        if( prefix && !url.path.startsWith( '/' + prefix ) ) {
            return {}
        }
        let path = url.path.substr( 1 + ( prefix && prefix.length + 1 || 0 ) )
        if( path === '' || path === '/' ) {
            path = 'index'
        }
        let nextPart = path.indexOf( '/' )
        let route = state.routes
        let pathParameters = {}
        do {
            let part = nextPart > -1 ? path.substr( 0, nextPart ) : path
            if( part in route ) {
                route = route[part]
            } else if( route.variable ) {
                pathParameters[route.variable.key] = serverConfig.current.decodePathParameters ? decodeURIComponent( part.replace( /\+/g, '%20' ) ) : part
                route = route.variable || {}
            } else {
                route = {}
                break
            }

            if( nextPart > -1 && ( route && !route.catchall ) ) {
                path = path.substr( nextPart + 1 )
                nextPart = path.indexOf( '/' )
                if( nextPart === -1 ) {
                    nextPart = path.indexOf( '.' ) > -1 ? nextPart.length : -1
                }
            } else {
                break
            }
        } while( path.length > 0 )
        return {
            handler: route && ( route.handler || ( route.index && route.index.handler ) ),
            pathParameters: pathParameters,
            middleware: route && ( route.middleware || ( route.index && route.index.middleware ) )
        }
    }
}
