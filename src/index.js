const log = require( './log' )
const start = require( './start' )
const cluster = require( 'cluster' )

/**
 * Startup function for the spliffy server
 * Spliffy will start up in a forked process so that if any uncaught exceptions are thrown a new process can be initialized and the server restarted.
 * Startup will exponentially back off if the server crashes within 1 second of starting up
 * @param config See https://github.com/narcolepticsnowman/spliffy#config
 * @returns {Promise<void>} an empty promise...
 */
let consecutiveFailures = 0
let lastStart = new Date().getTime()
const spliffy = ( config ) => {
    if( cluster.isMaster ) {
        cluster.fork()
        cluster.on( 'exit', ( worker ) => {

            const now = new Date().getTime()
            if( now - lastStart <= 1000 ) {
                consecutiveFailures++
            } else {
                consecutiveFailures = 0
            }
            const waitms = Math.pow( 2, consecutiveFailures ) * 100
            log.error( `Server crashed, restarting in ${waitms}ms` )
            setTimeout( () => {
                cluster.fork()
                lastStart = new Date().getTime()
            }, waitms )
        } )
    } else {
        start( config )
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

spliffy.log = log

module.exports = spliffy