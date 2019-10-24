const log = require( './log' )
const start = require('./start')
const cluster = require('cluster')

/**
 * Startup function for the spliffy server
 * @param config See https://github.com/narcolepticsnowman/spliffy#config
 * @returns {Promise<void>} an empty promise...
 */
const spliffy = (config)=>{
    if(cluster.isMaster){
        cluster.fork()
        cluster.on('exit', (worker)=>{
            log.info('Server crashed, restarting in 100ms')
            setTimeout(()=>cluster.fork, 100)
        })
    } else {
        start(config)
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