const serverConfig = require( './serverConfig' )
const dispatcher = require( './dispatcher' )
const routes = require( './routes' )
const secure = require( './secure' )
const log = require( './log' )
const uws = require( 'uWebSockets.js' )
const { randomNonsense } = require( "./serverConfig" );

module.exports = async function( config ) {
    if( !config || !config.routeDir ) {
        throw 'You must supply a config object with at least a routeDir property. routeDir should be a full path.'
    }
    log.gne( 'Starting Spliffy!' )
    serverConfig.init( config )
    log.info( 'Loading routes' )
    await routes.init()
    log.gne( 'Routes Initialized!' )

    if( config.secure ) {
        secure.startHttps( config.secure )
    } else {
        uws.App().any( '/*', dispatcher )
            .listen( serverConfig.current.host || '0.0.0.0', serverConfig.current.port, ( token ) => {
                if( token ) {
                    log.gne( `Server initialized at ${new Date().toISOString()} and listening on port ${serverConfig.current.port}` )
                } else {
                    throw new Error( `Failed to start server on port ${serverConfig.current.port}` )
                }
            } )
    }
    process
        .on( 'unhandledRejection', ( reason, p ) => {
            log.error( randomNonsense(), reason, 'Unhandled Rejection at Promise', p )
        } )
        .on( 'uncaughtException', ( err, origin ) => {
            log.error( randomNonsense(), `Caught exception: ${err}\n` +
                `Exception origin: ${origin}` )
        } )
}
