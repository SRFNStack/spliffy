
const staticHandler = require( './staticHandler' )
const serverConfig = require( './serverConfig' )

const addRoute = ( routes, path, name, route ) => {
    let routeData = getNewRouteData( name, routes )
    if( routes[routeData.name] ) {
        throw `Duplicate route name found for route file ${path}`
    }
    routes[routeData.name] = Object.assign( routeData.route, route )
}

const addStaticRoute = async ( routes, f, path, inheritedMiddleware ) => {
    let route = {
        handler: await staticHandler.create( path, f.name, serverConfig.current.staticContentTypes ),
        static: true,
        middleware: inheritedMiddleware
    }

    addRoute( routes, path, f.name, route )
    for( let ext of serverConfig.current.resolveWithoutExtension ) {
        if( f.name.endsWith( ext ) ) {
            addRoute( routes, path, f.name.substr( 0, f.name.length - ext.length ), route )
        }
    }
}


/**
 * Build a route data with an initialized route object
 * @param name The name of the route
 * @param routes The current routes, used for validation
 * @returns {{route: {}, name: *}|{route: {key: string}, name: string}|{route: {catchall: boolean}, name: string}}
 */
const getNewRouteData = ( name, routes ) => {
    if( name.startsWith( '$' ) && name.indexOf( '.' ) === -1 ) {
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
    } else {
        return { name, route: {} }
    }
}


module.exports = {
    getNewRouteData,
    addStaticRoute,
    addRoute
}