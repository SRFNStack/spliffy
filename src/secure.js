const serverConfig = require( './serverConfig' )
const fs = require( 'fs' )
const log = require( './log' )
const path = require( 'path' )
const uws = require( 'uWebSockets.js' )

const startHttpRedirect = () => {
    //redirect http to https
    let port = serverConfig.current.port;
    uws.App().any( "/*",
        ( req, res ) => {
            try {
                res.writeHead( 301, { 'Location': `https://${req.headers.host}:${serverConfig.current.port}${req.url}` } )
                res.end()
            } catch( e ) {
                log.error( `Failed to handle http request on port ${serverConfig.current.port}`, req.url, e )
            }
        }
    ).listen( serverConfig.current.host || '0.0.0.0', port, ( token ) => {
        if( token ) {
            log.gne( `Http redirect server initialized at ${new Date().toISOString()} and listening on port ${port}` )
        } else {
            throw new Error( `Failed to start server on port ${port}` )
        }
    } )
}

let getHttpsApp = () => {
    const secure = serverConfig.current.secure
    if( !secure.key || !secure.cert ) throw 'You must supply an secure key and cert!'
    let keyPath = path.resolve( secure.key )
    let certPath = path.resolve( secure.cert )
    if( !fs.existsSync( keyPath ) ) throw `Can't find https key file: ${keyPath}`
    if( !fs.existsSync( certPath ) ) throw `Can't find https cert file: ${keyPath}`
    return uws.App( {
        key_file_name: secure.key,
        cert_file_name: secure.cert
    } )
}
module.exports = {
    getHttpsApp, startHttpRedirect
}
