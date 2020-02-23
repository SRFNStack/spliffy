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

const getRouteInfo = ( name, routes ) => {
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

const findRoutes = async( f, path ) => {
    let routes = {}
    if( f.isDirectory() ) {

        let routeInfo = getRouteInfo( f.name, routes )

        return Promise.all(
            fs.readdirSync( path, { withFileTypes: true } )
              .map(
                  ( f ) => findRoutes( f, path + '/' + f.name )
              ) ).then(
            routes => ( { [ routeInfo.name ]: routes.reduce( ( r, routes ) => ( { ...r, ...routes } ), routeInfo.route ) } )
        )
    } else if( !serverConfig.current.staticMode && f.name.endsWith( '.js' ) && !f.name.endsWith( '.static.js' ) ) {
        let routeData = getRouteInfo( f.name.substr( 0, f.name.length - 3 ), routes )
        let handlerFile = require( path )
        let handlers = handlerFile.handlers || handlerFile
        let handlerInfo = handlerFile.handlers &&
                          Object.keys( handlerFile )
                                .filter( k => k !== 'handlers' )
                                .reduce( ( r, k ) => r[ k ] = handlerFile[ k ] )
                          || {}
        routeData.route.handler = {}
        routeData.route.routeInfo = handlerInfo
        for( let method in handlers ) {
            let handler = handlers[ method ].handler || handlers[ method ]
            let handlerInfo = handlerFile.handler &&
                              Object.keys( handlerFile )
                                    .filter( k => k !== 'handler' )
                                    .reduce( ( r, k ) => r[ k ] = handlerFile[ k ] )
                              || {}
            if( !method.match( '^[A-Z]+$' ) ) {
                throw `Method: ${method} in file ${path} is invalid. Method names must be all uppercase. You should not export properties other than the request methods you want to expose!`
            }
            if( typeof handler !== 'function' ) {
                throw `Request method ${method} must be a function. Got: ${handlers[ method ]}`
            }
            routeData.route.handler[ method ] = handler
            routeData.route.handlerInfo = handlerInfo
        }
        routes[ routeData.name ] = routeData.route
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

const init = ( now ) => {
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

        }, now ? 0 : 100 )
    }

}

module.exports = {
    init,
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