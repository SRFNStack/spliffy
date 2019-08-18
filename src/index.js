const http = require( 'http' )
const https = require( 'https' )
const serverConfig = require( './serverConfig' )
const handler = require( './handler' )
const content = require( './content' )
const routes = require( './routes' )
const path = require( 'path' )
const fs = require( 'fs' )
const letsEncrypt = require( './letsEncrypt' )
const PassThrough = require( 'stream' ).PassThrough
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
const spliffy = function( config ) {
    serverConfig.current = config || {}
    if( !config.routeDir ) {
        throw 'You must supply a config object with at least a routeDir property. routeDir should be a full path.'
    }
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


    routes.init( true )


    serverConfig.current.port = config.port || 10420

    const startHttps = () => {
        serverConfig.current.httpsServer = https.createServer(
            {
                key: serverConfig.current.ssl.keyData,
                cert: serverConfig.current.ssl.certData
            },
            handler
        )
        serverConfig.current.httpsServer.listen( serverConfig.current.ssl.port )
        log.info( `Server initialized at ${new Date().toISOString()} and listening on port ${serverConfig.current.ssl.port} and ${serverConfig.current.port}` )
    }
    if( config.ssl ) {
        serverConfig.current.ssl.port = config.ssl.port || 14420
        http.createServer(
            ( req, res ) => {
                try {
                    if( req.url.startsWith( '/.well-known/acme-challenge/' ) ) {
                        const token = req.url.split( '/' ).slice( -1 )[ 0 ]
                        let challenge = letsEncrypt.challenge( token )
                        if( challenge ) {
                            res.writeHead( 200, { 'Content-Type': 'text/plain; charset=utf-8' } )
                            new PassThrough().end( Buffer.from( challenge.keyAuthorization, 'utf8' ) ).pipe( res )
                            return
                        }
                    }
                    res.writeHead( 301, { 'Location': `https://${req.headers[ 'host' ].split( ':' )[ 0 ]}:${serverConfig.current.ssl.port}${req.url}` } )
                    res.end()
                } catch(e) {
                    log.error( 'Failed to handle http request on port ' + serverConfig.current.port, req.url, e )
                }
            } )
            .listen( serverConfig.current.port )
        if( config.ssl.letsEncrypt ) {
            letsEncrypt.init( true )
                       .catch( e => {
                           setTimeout(()=>{throw e})
                       } )
                       .then( () => startHttps() )

        } else {
            if( !config.ssl.key || !config.ssl.cert ) throw 'You must supply an ssl key and cert!'
            let keyPath = path.resolve( config.ssl.key )
            let certPath = path.resolve( config.ssl.cert )
            if( !fs.existsSync( keyPath ) ) throw `Can't find ssl key file: ${keyPath}`
            if( !fs.existsSync( certPath ) ) throw `Can't find ssl cert file: ${keyPath}`
            serverConfig.current.ssl.keyData = fs.readFileSync( serverConfig.ssl.keyPath )
            serverConfig.current.ssl.certData = fs.readFileSync( certPath )
            startHttps()
        }
    } else {
        http.createServer( handler )
            .listen( serverConfig.current.port )
        log.info( `Server initialized at ${new Date().toISOString()} and listening on port ${serverConfig.current.port}` )
    }
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