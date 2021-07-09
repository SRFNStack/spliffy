const { validateMiddleware, mergeMiddleware } = require( "./middleware" )
const staticHandler = require( './staticHandler' )
const { getContentTypeByExtension } = require( "./content" )
const fs = require( 'fs' )
const path = require( 'path' )
const serverConfig = require( './serverConfig' )
const { HTTP_METHODS } = require( './handler' )

const isVariable = part => part.startsWith( '$' )
const getVariableName = part => part.substr( 1 )
const getPathPart = name => {
    if(name === 'index'){
        return ''
    } if( name.startsWith( '$' ) ) {
        return `:${name.substr( 1 )}`
    } else if( name.endsWith( '+' ) ) {
        return `${name.substr( 0, name.length - 1 )}/*`
    } else {
        return name
    }
}
const doFindRoutes = ( currentFile, filePath, urlPath, pathParameters, inheritedMiddleware ) => {
    let routes = []
    let name = currentFile.name;
    if( currentFile.isDirectory() ) {
        if( isVariable( name ) ) {
            pathParameters = pathParameters.concat( getVariableName( name ) )
        }
        const files = fs.readdirSync( filePath, { withFileTypes: true } )

        const dirMiddleware = files
            .filter( f => f.name.endsWith( '.mw.js' ) )
            .map( f => {
                let mw = require( filePath + '/' + f.name )
                if( !mw.middleware ) {
                    throw new Error( '.mw.js files must export a middleware property' )
                }
                validateMiddleware( mw.middleware )
                return mw.middleware
            } )
            .reduce( ( result, incoming ) => mergeMiddleware( incoming, result ), inheritedMiddleware )

        routes = routes.concat( (
                files
                    .filter( f => !f.name.endsWith( '.mw.js' ) )
                    .map(
                        ( f ) => doFindRoutes(
                            f,
                            filePath + '/' + f.name,
                            urlPath + '/' + getPathPart( name ),
                            pathParameters,
                            dirMiddleware
                        )
                    )
            ).flat()
        )
    } else if( !serverConfig.current.staticMode && name.endsWith( '.rt.js' ) ) {
        name = name.substr( 0, name.length - '.rt.js'.length )
        if( isVariable( name ) ) {
            pathParameters = pathParameters.concat( getVariableName( name ) )
        }
        let route = {
            pathParameters,
            urlPath: `${urlPath}/${getPathPart( name )}`,
            filePath,
            handlers: {}
        }
        const handlers = require( filePath )
        route.middleware = mergeMiddleware( handlers.middleware || [], inheritedMiddleware )
        for( let method of Object.keys( handlers ).filter( k => k !== 'middleware' ) ) {
            if( HTTP_METHODS.indexOf( method ) === -1 ) {
                throw `Method: ${method} in file ${filePath} is not a valid http method. It must be one of: ${HTTP_METHODS}. Method names must be all uppercase.`
            }
            let handler = handlers[method]
            if( typeof handler !== 'function' ) {
                throw `Request method ${method} must be a function. Got: ${handlers[method]}`
            }
            route.handlers[method] = handler
        }
        routes.push( route )
    } else {
        if( isVariable( name ) ) {
            pathParameters = pathParameters.concat( getVariableName( name ) )
        }
        let contentType = getContentTypeByExtension( name, serverConfig.current.staticContentTypes )
        let route = {
            pathParameters,
            urlPath: `${urlPath}/${getPathPart( name )}`,
            filePath,
            handlers: staticHandler.create( filePath, contentType ),
            middleware: inheritedMiddleware
        }

        if( !route.handlers.OPTIONS ) {

        }

        routes.push( route )

        for( let ext of serverConfig.current.resolveWithoutExtension ) {
            if( name.endsWith( ext ) ) {
                let noExtRoute = Object.assign( {}, route )
                noExtRoute.urlPath = `${urlPath}/${getPathPart( name.substr( 0, name.length - ext.length ) )}`
                routes.push( noExtRoute )
            }
        }
    }
    return routes
}


module.exports = {
    findRoutes(){
        const fullRouteDir = path.resolve( serverConfig.current.routeDir )
        if( !fs.existsSync( fullRouteDir ) ) {
            throw `can't find route directory: ${fullRouteDir}`
        }
        let appMiddleware = mergeMiddleware( serverConfig.current.middleware || [], {} )
        return fs.readdirSync( fullRouteDir, { withFileTypes: true } )
            .map(
                f => doFindRoutes( f, fullRouteDir + '/' + f.name, '', [], appMiddleware )
            )
            .flat()
    }
}