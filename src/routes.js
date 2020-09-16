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
 * Recursively walk the specified directory to discover all of the routes and middleware
 * @param f The file or directory to search for routes
 * @param path The full path to the current file
 * @returns {Promise<{} | Promise<(Promise<(Promise<T | never>|{})[] | never>|{})[] | never>>}
 */
const findRoutes = async( f, path ) => {
    let routes = {}
    if( f.isDirectory() ) {

        let routeData = getNewRouteData( f.name, routes )

        return Promise.all(
            fs.readdirSync( path, { withFileTypes: true } )
              .map(
                  ( f ) => findRoutes( f, path + '/' + f.name )
              ) ).then(
            routes => ( { [ routeData.name ]: routes.reduce( ( r, routes ) => ( { ...r, ...routes } ), routeData.route ) } )
        )
    } else if( !serverConfig.current.staticMode && f.name.endsWith( '.rt.js' )) {
        let routeData = getNewRouteData( f.name.substr( 0, f.name.length - '.rt.js'.length ), routes )
        routes[ routeData.name ] = {...(routes[routeData.name] || {}), ...buildRoute(routeData.route, path)}
    } else if( !serverConfig.current.staticMode && f.name.endsWith( '.mw.js' )){
        let routeData = getNewRouteData( f.name.substr( 0, f.name.length - '.mw.js'.length ), routes )
        let middleware = require(path)
        if(!middleware.middleware){
            throw new Error(".mw.js files must export a middleware property")
        }
        routes[routeData.name] = {...(routes[routeData.name] || {}), middleware: middleware.middleware }
    } else {
        let route = {
            handler: await staticHandler.create( path, f.name, serverConfig.current.staticContentTypes ),
            static: true
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
    return routes
}

/**
 * load and gather data about the specified route handler file
 * @param route The initialized route data
 * @param path The full path to the file
 * @returns {*}
 */
const buildRoute = (route, path) => {
    let handlers = require( path )

    route.handler = {}
    for( let method in handlers ) {
        let handler = handlers[ method ]
        if( !method.match( '^[A-Z]+$' ) ) {
            throw `Method: ${method} in file ${path} is invalid. Method names must be all uppercase. You should not export properties other than the request methods you want to expose!`
        }
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
const init = ( ) => {
    if( !state.initializing ) {
        state.initializing = true
        //debounce fs events
        setTimeout( () => {
            log.info( 'Loading routes' )
            const fullRouteDir = path.resolve( serverConfig.current.routeDir )
            if( !fs.existsSync( fullRouteDir ) ) throw `can't find route directory: ${fullRouteDir}`
            Promise.all(
                fs.readdirSync( serverConfig.current.routeDir, { withFileTypes: true } )
                  .map(
                      ( f ) => findRoutes( f, fullRouteDir + '/' + f.name )
                  )
            ).then(
                routes => {
                    state.initializing = false
                    state.routes = routes.reduce( ( r, rt ) => ( { ...r, ...rt } ), {} )
                }
            )

        }, 0)
    }

}

module.exports = {
    init,
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
            pathParameters: pathParameters
        }
    }
}