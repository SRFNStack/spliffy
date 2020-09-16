const serverConfig = require( './serverConfig' )
const http = require( 'http' )
const https = require( 'https' )
const PassThrough = require( 'stream' ).PassThrough
const fs = require( 'fs' )
const log = require('./log')
const forge = require('node-forge')
const dispatcher = require('./dispatcher')

const state = {
    server: null,
    port: 14420,
    keyData: null,
    certData: null,
    cn: null,
    acmeChallengeProvider: null
}

const startHttpRedirect = () => {
    //redirect http to https
    http.createServer(
        ( req, res ) => {
            try {
                if( req.url.startsWith( '/.well-known/acme-challenge/' ) ) {
                    const token = req.url.split( '/' ).slice( -1 )[ 0 ]
                    let challenge = state.acmeChallengeProvider( token )
                    if( challenge ) {
                        log.info("Received challenge request. Responding with authorization.")
                        res.writeHead( 200, { 'Content-Type': 'text/plain; charset=utf-8' } )
                        new PassThrough().end( Buffer.from( challenge.keyAuthorization, 'utf8' ) ).pipe( res )
                        return
                    }
                }
                res.writeHead( 301, { 'Location': `https://${req.headers.host || state.cn}:${serverConfig.current.secure.port}${req.url}` } )
                res.end()
            } catch(e) {
                log.error( 'Failed to handle http request on port ' + serverConfig.current.port, req.url, e )
            }
        } )
        .listen( serverConfig.current.port )
}

module.exports = {
    startHttps: ( secure ) => {
        if( !secure.key || !secure.cert ) throw 'You must supply an secure key and cert!'
        let keyPath = path.resolve( secure.key )
        let certPath = path.resolve( secure.cert )
        if( !fs.existsSync( keyPath ) ) throw `Can't find https key file: ${keyPath}`
        if( !fs.existsSync( certPath ) ) throw `Can't find https cert file: ${keyPath}`
        updateIfChanged( fs.readFileSync( keyPath ), fs.readFileSync( certPath ) )
    },
    setAcmeChallengeProvider: ( provider ) => {
        state.acmeChallengeProvider = provider
    },
    startHttpRedirect,
    updateIfChanged: ( newKeyData, newCertData ) => {
        if( !state.keyData || !state.certData || !state.keyData.equals( newKeyData ) || !state.certData.equals( newCertData ) ) {
            state.keyData = newKeyData
            state.certData = newCertData
            const certificate = forge.pki.certificateFromPem( state.certData )
            state.cn = certificate.subject.getField( 'CN').value
            let oldServer = state.server
            state.server = https.createServer(
                {
                    key: state.keyData,
                    cert: state.certData
                },
                dispatcher
            )
            if( oldServer ) {
                oldServer.close( () => state.server.listen( serverConfig.current.secure.port ) )
                oldServer = null
            } else {
                state.server.listen( serverConfig.current.secure.port )
            }
            log.gne( `Server initialized at ${new Date().toISOString()} and listening on port ${serverConfig.current.secure.port} and ${serverConfig.current.port}` )
        }

    }
}