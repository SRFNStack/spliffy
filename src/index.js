const http = require( 'http' )
const serverConfig = require( './serverConfig' )
const dispatcher = require( './dispatcher' )
const content = require( './content' )
const routes = require( './routes' )
const secure = require( './secure' )
const letsEncrypt = require( './letsEncrypt' )
const log = require( './log' )
const defaultHeaders = {
    acceptsDefault: '*/*',
    defaultContentType: '*/*'
}

/**
 * Startup function for the spliffy server
 * @param config See https://github.com/narcolepticsnowman/spliffy#config
 * @returns {Promise<void>} an empty promise...
 */
const spliffy = async function( config ) {
    if( !config || !config.routeDir ) {
        throw 'You must supply a config object with at least a routeDir property. routeDir should be a full path.'
    }
    serverConfig.current = config || {}
    Object.assign( content.contentHandlers, config.contentHandlers )
    if( !config.hasOwnProperty( 'decodePathParameters' ) ) serverConfig.current.decodePathParameters = true


    serverConfig.current.acceptsDefault = config.acceptsDefault || defaultHeaders.acceptsDefault
    serverConfig.current.defaultContentType = config.defaultContentType || defaultHeaders.defaultContentType

    if( serverConfig.current.filters ) {
        if( !Array.isArray( serverConfig.current.filters ) )
            throw 'Filters must be an array of functions'

        serverConfig.current.filters.forEach( f => {
            if( typeof f !== 'function' ) {
                throw 'Each element in the array of filters must be a function'
            }
        } )
    }

    if( !serverConfig.current.hasOwnProperty( 'logAccess' ) ) {
        serverConfig.current.logAccess = true
    }
    serverConfig.current.port = config.port || 10420
    routes.init( true )


    let httpServer

    //Promise to be healthy
    const startServer = () => new Promise( ( resolve ) => {
        try {
            if( config.secure ) {

                if( config.secure.letsEncrypt ) {
                    letsEncrypt.init( true )
                               .catch( e => {
                                   setTimeout( () => {throw e} )
                               } )

                } else {
                    secure.startHttps( config.secure )
                }
                secure.startHttpRedirect()
            } else {
                httpServer = http.createServer( dispatcher )
                                 .listen( serverConfig.current.port )
                log.info( `Server initialized at ${new Date().toISOString()} and listening on port ${serverConfig.current.port}` )
            }
        } catch(e) {
            resolve(e)
            log.error( 'Is it getting hot in here?', e )
            const secureServers = secure.getServers()
            if( secureServers.redirectServer ) secureServers.redirectServer.close( () => {} )
            if( secureServers.server ) secureServers.server.close( () => {log.error( 'server stopped' )} )
            if( httpServer ) httpServer.close( () => {log.error( 'server stopped' )} )
            setTimeout(
                startServer
                , 100 )
        }
    } )
    return startServer()
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

spliffy.log = log

module.exports = spliffy