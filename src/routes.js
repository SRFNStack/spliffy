const fs = require( 'fs' )
const staticHandler = require( './staticHandler' )
const path = require( 'path' )
const serverConfig = require( './serverConfig' )
const log = require( './log' )
const state = {
    routes: {},
    initializing: false,
    hasPendingFsEvent: false
}
const HTTP_METHODS = [ 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'CONNECT', 'TRACE' ]

/**
 * Build a route data with an initialized route object
 * @param name The name of the route
 * @param routes The current routes, used for validation
 * @returns {{route: {}, name: *}|{route: {key: string}, name: string}|{route: {catchall: boolean}, name: string}}
 */
const getNewRouteData = ( name, routes ) => {
    if( name.startsWith( '$' ) ) {
        if( 'variable' in routes ) {
            throw `You can not have two path variables in the same dir. Conflicting handlers: ${name} and \$${routes.variable.key}.`
        }
        return {
            name: 'variable',
            route: {
                key: name.substr( 1 )
            }
        }
    } else if( name.endsWith( '+' ) ) {
        return {
            name: name.substr( 0, name.length - 1 ),
            route: {
                catchall: true
            }
        }
    } else
        return { name, route: {} }
}

/**
 * middleware is stored as an object where the properties are request methods the middleware applies to
 * if a middleware applies to all methods, the property ALL is used
 * example:
 * {
 *     GET: [(req,res,next)=>console.log('ice cream man')]
 *     POST: [(req,res,next)=>console.log('gelato')]
 *     ALL: [(req,res,next)=>console.log('bruce banner')]
 * }
 */
const mergeMiddleware = ( incoming, existing ) => {
    const mergeInto = cloneMiddleware( existing )

    validateMiddleware( incoming )
    if( Array.isArray( incoming ) ) {
        mergeInto.ALL = ( existing.ALL || [] ).concat( incoming )
    } else if( typeof incoming === 'object' ) {
        for( let method in incoming ) {
            let upMethod = method.toUpperCase()
            mergeInto[ upMethod ] = ( mergeInto[ method ] || [] ).concat( incoming[ upMethod ] || [] )
        }
    }
    return mergeInto
}

const cloneMiddleware = ( middleware ) => {
    const clone = { ...middleware }
    for( let method in middleware ) {
        clone[ method ] = [ ...( middleware[ method ] || [] ) ]
    }
    return clone
}

/**
 * Ensure the given middleware is valid
 * @param middleware
 */
const validateMiddleware = ( middleware ) => {
    if( Array.isArray( middleware ) )
        validateMiddlewareArray( middleware )

    else if( typeof middleware === 'object' ) {
        for( let method in middleware ) {
            //ensure methods are always available as uppercase
            let upMethod = method.toUpperCase()
            middleware[ upMethod ] = middleware[ method ]
            validateMiddlewareArray( middleware[ upMethod ] )
        }
    } else {
        throw new Error( 'Invalid middleware definition: ' + middleware )
    }
}

const validateMiddlewareArray = ( arr ) => {
    if( !Array.isArray( arr ) )
        throw 'middleware must be an array of functions'

    arr.forEach( f => {
        if( typeof f !== 'function' ) {
            throw 'Each element in the array of middleware must be a function'
        }
    } )
}

/**
 * Recursively walk the specified directory to discover all of the routes and middleware
 * @param currentFile The file or directory to search for routes
 * @param path The full path to the current file
 * @param inheritedMiddleware Middleware that is inherited from the app or parent routes
 * @returns {Promise<{} | Promise<(Promise<(Promise<T | never>|{})[] | never>|{})[] | never>>}
 */
const findRoutes = async( currentFile, path, inheritedMiddleware ) => {
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
                          routes => ( { [ routeData.name ]: routes.reduce( ( r, routes ) => ( { ...r, ...routes } ), routeData.route ) } )
                      )
    } else if( !serverConfig.current.staticMode && currentFile.name.endsWith( '.rt.js' ) ) {
        let routeData = getNewRouteData( currentFile.name.substr( 0, currentFile.name.length - '.rt.js'.length ), routes )
        routes[ routeData.name ] = buildRoute( routeData.route, path, inheritedMiddleware )
    } else {
        await setStaticRoutes( routes, currentFile, path, inheritedMiddleware )
    }
    return routes
}

const setStaticRoutes = async( routes, f, path, inheritedMiddleware ) => {
    let route = {
        handler: await staticHandler.create( path, f.name, serverConfig.current.staticContentTypes ),
        static: true,
        middleware: inheritedMiddleware
    }
    if( f.name.endsWith( '.html' ) || f.name.endsWith( '.htm' ) ) {
        routes[ f.name.split( '.html' )[ 0 ] ] = route
        routes[ f.name ] = route
    } else if( f.name.startsWith( 'index.' ) ) {
        routes[ f.name ] = route
        routes[ 'index' ] = route
    } else {
        routes[ f.name ] = route
    }
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
        let handler = handlers[ method ]
        if( typeof handler !== 'function' ) {
            throw `Request method ${method} must be a function. Got: ${handlers[ method ]}`
        }
        route.handler[ method ] = handler
    }

    return route
}

/**
 * Load the routes
 */
const init = () => {
    if( !state.initializing ) {
        state.initializing = true
        //debounce fs events
        setTimeout( () => {
            log.info( 'Loading routes' )
            const fullRouteDir = path.resolve( serverConfig.current.routeDir )
            if( !fs.existsSync( fullRouteDir ) ) throw `can't find route directory: ${fullRouteDir}`
            let appMiddleware = mergeMiddleware( serverConfig.current.middleware, {} )
            Promise.all(
                fs.readdirSync( serverConfig.current.routeDir, { withFileTypes: true } )
                  .map(
                      ( f ) => findRoutes( f, fullRouteDir + '/' + f.name, appMiddleware )
                  )
            ).then(
                routes => {
                    state.initializing = false
                    state.routes = routes.reduce( ( r, rt ) => ( { ...r, ...rt } ), {} )
                    log.gne("Routes Initialized!")
                }
            )

        }, 0 )
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
        if( path === '' || path === '/' ) path = 'index'
        let nextPart = path.indexOf( '/' )
        let route = state.routes
        let pathParameters = {}
        do {
            let part = nextPart > -1 ? path.substr( 0, nextPart ) : path
            if( part in route ) {
                route = route[ part ]
            } else if( route.variable ) {
                pathParameters[ route.variable.key ] = serverConfig.current.decodePathParameters ? decodeURIComponent( part.replace( /\+/g, '%20' ) ) : part
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