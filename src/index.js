const http = require( 'http' )
const serverConfig = require( './serverConfig' )
const handler = require( './handler' )
const content = require( './content' )
const routes = require( './routes' )
const defaultHeaders = {
    acceptsDefault: '*/*',
    defaultContentType: '*/*'
}

const spliffy = function( config ) {
    serverConfig.current = config || {}
    if( !config.routeDir ) {
        throw 'You must supply a config object with at least a routeDir property. routeDir should be a full path.'
    }
    Object.assign( content.contentHandlers, config.contentHandlers )
    if( !config.hasOwnProperty( 'decodePathParameters' ) ) serverConfig.current.decodePathParameters = true
    serverConfig.current.acceptsDefault = config.acceptsDefault || defaultHeaders.acceptsDefault
    serverConfig.current.defaultContentType = config.defaultContentType || defaultHeaders.defaultContentType
    routes.init()
    let httpServer = http.createServer( handler.create( serverConfig.current ) )
    let port = config.port || 10420
    httpServer.listen( port )
    console.log( `Server initialized at ${new Date().toISOString()} and listening on port ${port}` )
}

/**
 * A helper for creating a redirect handler
 * @param location The location to redirect to
 * @param permanent Whether this is a permanent redirect or not
 */
spliffy.redirect = ( location, permanent = true ) => () => ( {
    statusCode: permanent ? 301 : 302,
    headers: {
        'location': location
    }
} )

module.exports = spliffy