const fs = require( 'fs' )
const staticHandler = require( './staticHandler' )
const path = require( 'path' )
const serverConfig = require( './serverConfig' )
const state = {
    routes: {},
    initializing: false
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

const findRoutes = ( f, path ) => {
    let routes = {}
    if( serverConfig.current.watchFiles ) {
        try {
            fs.watch( path, '', ()=> init() )
        } catch(e) {
            fs.unwatchFile(path)
            init()
        }
    }
    if( f.isDirectory() ) {

        let routeInfo = getRouteInfo( f.name, routes )
        routes[ routeInfo.name ] = {
            ...routeInfo.route,
            ...fs.readdirSync( path, { withFileTypes: true } )
                 .reduce(
                     ( children, f ) => ( { ...children, ...findRoutes( f, path + '/' + f.name ) } ),
                     {} )
        }
    } else if( f.name.endsWith( '.js' ) && !f.name.endsWith( '.static.js' ) ) {
        let routeInfo = getRouteInfo( f.name.substr( 0, f.name.length - 3 ), routes )
        routeInfo.route.handler = require( path )
        routes[ routeInfo.name ] = routeInfo.route
    } else {
        let route = {
            handler: staticHandler.create( path, f.name, serverConfig.current.staticContentTypes ),
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

const init = () => {
    if(!state.initializing){
        state.initializing = true
        console.log('Reloading routes')
        const fullRouteDir = path.resolve( serverConfig.current.routeDir )
        state.routes = fs.readdirSync( serverConfig.current.routeDir, { withFileTypes: true } )
                         .reduce(
                             ( children, f ) => ( { ...children, ...findRoutes( f, fullRouteDir + '/' + f.name ) } ),
                             {} )
        //debounce fs events
        setTimeout(()=>state.initializing = false, 2000)
    }

}

module.exports = {
    current: state.routes,
    init,
    find: ( url ) => {
        let path = url.path.substr( 1 + ( serverConfig.current.routePrefix && serverConfig.current.routePrefix.length + 1 || 0 ) )
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