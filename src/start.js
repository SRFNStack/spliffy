const { validateMiddleware } = require('./routes.js')
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

const nonsense = [
    'Is it getting hot in here?',
    'Ouch...',
    'Hold my beer',
    'Gettin\' Sendy',
    'Look a squirrel!',
    'I swear I only had 3',
    'I see a light...',
    'Totally zooted'
]

const randomNonsense = () => nonsense[ Math.floor( Math.random() * nonsense.length ) ]

module.exports = async function( config ) {
    if( !config || !config.routeDir ) {
        throw 'You must supply a config object with at least a routeDir property. routeDir should be a full path.'
    }
    serverConfig.current = config || {}
    Object.assign( content.contentHandlers, config.contentHandlers )
    if( !config.hasOwnProperty( 'decodePathParameters' ) ) serverConfig.current.decodePathParameters = true


    serverConfig.current.acceptsDefault = config.acceptsDefault || defaultHeaders.acceptsDefault
    serverConfig.current.defaultContentType = config.defaultContentType || defaultHeaders.defaultContentType

    if( serverConfig.current.middleware ) {
        validateMiddleware(serverConfig.current.middleware)
    }

    if( !serverConfig.current.hasOwnProperty( 'logAccess' ) ) {
        serverConfig.current.logAccess = true
    }
    serverConfig.current.port = config.port || 10420
    routes.init()

    let httpServer

    let consecutiveFailures = 0
    let lastStart = new Date().getTime()


    const doStart = ()=>{
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
            log.gne( `Server initialized at ${new Date().toISOString()} and listening on port ${serverConfig.current.port}` )
        }
    }
    while(true){
        try {
            doStart()
        } catch(e) {
            log.error( randomNonsense(), e )
            const secureServers = secure.getServers()
            if( secureServers.redirectServer ) secureServers.redirectServer.close( () => {} )
            if( secureServers.server ) secureServers.server.close( () => {log.error( 'server crashed' )} )
            if( httpServer ) httpServer.close( () => {log.error( 'server crashed' )} )
            const waitms = Math.pow( 2, consecutiveFailures ) * 100
            log.error( `Server crashed, restarting in ${waitms}ms` )
            const now = new Date().getTime()
            if( now - lastStart <= 10*60*1000 ) {
                consecutiveFailures++
            } else {
                consecutiveFailures = 0
            }
            setTimeout( () => {
                lastStart = new Date().getTime()
                doStart()
            }, waitms )
        }
    }

}