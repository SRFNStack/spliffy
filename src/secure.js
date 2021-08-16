const fs = require( 'fs' )
const log = require( './log' )
const path = require( 'path' )
const uws = require( 'uWebSockets.js' )

const startHttpRedirect = ( host, port) => {
    //redirect http to https
    uws.App().any( "/*",
        ( req, res ) => {
            try {
                res.writeHead( 301, { 'Location': `https://${req.headers.host}:${port}${req.url}` } )
                res.end()
            } catch( e ) {
                log.error( `Failed to handle http request on port ${port}`, req.url, e )
            }
        }
    ).listen( host || '0.0.0.0', port, ( token ) => {
        if( token ) {
            log.gne( `Http redirect server initialized at ${new Date().toISOString()} and listening on port ${port}` )
        } else {
            throw new Error( `Failed to start server on port ${port}` )
        }
    } )
}

let getHttpsApp = ({ key, cert }) => {
    if( !key || !cert ) throw 'You must set secure.key and secure.cert in the config to use https!'
    let keyPath = path.resolve( key )
    let certPath = path.resolve( cert )
    if( !fs.existsSync( keyPath ) ) throw `Can't find https key file: ${keyPath}`
    if( !fs.existsSync( certPath ) ) throw `Can't find https cert file: ${keyPath}`
    return uws.App( {
        key_file_name: keyPath,
        cert_file_name: certPath
    } )
}
module.exports = {
    getHttpsApp, startHttpRedirect
}
