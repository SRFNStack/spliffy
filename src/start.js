const serverConfig = require( './serverConfig' )
const log = require( './log' )
const server = require('./server')
const { randomNonsense } = require( "./serverConfig" );

module.exports = async function( config ) {
    if( !config || !config.routeDir ) {
        throw 'You must supply a config object with at least a routeDir property. routeDir should be a full path.'
    }
    process
        .on( 'unhandledRejection', ( reason, p ) => {
            log.error( randomNonsense(), reason, 'Unhandled Rejection at Promise', p )
        } )
        .on( 'uncaughtException', ( err, origin ) => {
            log.error( randomNonsense(), `Caught unhandled exception: ${err}\n` +
                `Exception origin: ${origin}` )
        } )

    serverConfig.init( config )
    log.gne( 'Starting Spliffy!' )
    server.start()
}
