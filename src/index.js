const http = require( 'http' )
const https = require( 'https' )
const serverConfig = require( './serverConfig' )
const handler = require( './handler' )
const content = require( './content' )
const routes = require( './routes' )
const path = require( 'path' )
const fs = require( 'fs' )
const letsEncrypt = require( './letsEncrypt' )
const PassThrough = require('stream').PassThrough
const base64url = require('base64url')
const jose = require('node-jose')

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
    serverConfig.current = config || {}
    if( !config.routeDir ) {
        throw 'You must supply a config object with at least a routeDir property. routeDir should be a full path.'
    }
    Object.assign( content.contentHandlers, config.contentHandlers )
    if( !config.hasOwnProperty( 'decodePathParameters' ) ) serverConfig.current.decodePathParameters = true


    serverConfig.current.acceptsDefault = config.acceptsDefault || defaultHeaders.acceptsDefault
    serverConfig.current.defaultContentType = config.defaultContentType || defaultHeaders.defaultContentType

    routes.init( true )


    let port = config.port || 10420
    if( config.ssl ) {
        let sslPort = config.ssl.port || 14420
        http.createServer(
            ( req, res ) => {
                if(serverConfig.current.ssl.letsEncrypt.challenge && req.url.match("\.well-known/acme-challenge/"+serverConfig.current.ssl.letsEncrypt.challenge.token)){
                    res.writeHead( 200, {'Content-Type': 'text/plain; charset=utf-8'})
                    new PassThrough().end(Buffer.from(serverConfig.current.ssl.letsEncrypt.keyAuthorization, 'utf8')).pipe(res)
                } else {
                    res.writeHead( 301, { 'Location': `https://${req.headers[ 'host' ].split( ':' )[ 0 ]}:${sslPort}${req.url}` } )
                    res.end()
                }

            } )
            .listen( port )
        if( config.ssl.letsEncrypt ) {
            await letsEncrypt.init()
        } else {
            if( !config.ssl.key || !config.ssl.cert ) throw 'You must supply an ssl key and cert!'
            let keyPath = path.resolve( config.ssl.key )
            let certPath = path.resolve( config.ssl.cert )
            if( !fs.existsSync( keyPath ) ) throw `Can't find ssl key file: ${keyPath}`
            if( !fs.existsSync( certPath ) ) throw `Can't find ssl cert file: ${keyPath}`
            serverConfig.current.ssl.keyData = fs.readFileSync( serverConfig.ssl.keyPath )
            serverConfig.current.ssl.certificateData = fs.readFileSync( certPath )
        }


        https.createServer(
            {
                key: serverConfig.current.ssl.keyData,
                cert: serverConfig.current.ssl.certificateData
            },
            handler.create( serverConfig.current )
        ).listen( sslPort )

        console.log( `Server initialized at ${new Date().toISOString()} and listening on port ${sslPort} and ${port}` )
    } else {
        http.createServer(
            handler.create( serverConfig.current ) )
            .listen( port )
        console.log( `Server initialized at ${new Date().toISOString()} and listening on port ${port}` )
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