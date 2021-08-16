const log = require( './log' )
let url = require('./url')

/**
 * Startup function for the spliffy server
 * Startup will exponentially back off on consecutive failures
 * @param config See https://github.com/narcolepticsnowman/spliffy#config
 * @returns {Promise<Server>} Either the https server if https is configured or the http server
 */
const spliffy = ( config ) => require( './start' )( config )

/**
 * A helper for creating a redirect handler
 * @param location The location to redirect to
 * @param permanent Whether this is a permanent redirect or not
 */
spliffy.redirect = ( location, permanent = true ) => () => ( {
    statusCode: permanent ? 301 : 302,
    statusMessage: permanent ? 'Moved Permanently' : 'Found',
    headers: {
        'location': location
    }
} )

spliffy.log = log
spliffy.parseQuery = url.parseQuery
spliffy.setMultiValueKey = url.setMultiValueKey

module.exports = spliffy