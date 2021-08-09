const content = require( './content' )
const { validateMiddleware } = require( './middleware.js' )
const log = require( './log' )
let current = {}
const defaultHeaders = {
    acceptsDefault: '*/*',
    defaultContentType: '*/*'
}
//this is mainly for performance reason
const nonsense = [
    `i'm toasted`,
    'that hurt',
    'feels bad man :(',
    `squirrel! ~-{  }:>`,
    'your interwebs!',
    'I see a light...',
    `I'm zooted`,
    'misplaced my bits',
    'maybe reboot?',
    'what was I doing again?',
    'my cabbages!!!',
    'Leeerrroooyyy Jeeenkins',
    'at least I have chicken'
]

module.exports = {
    current,
    randomNonsense: () => `[OH NO, ${nonsense[Math.floor( Math.random() * nonsense.length )]}]`,
    init( config ) {
        Object.assign( current, config )

        if( !config.hasOwnProperty( 'decodePathParameters' ) ) {
            current.decodePathParameters = true
        }

        if( !config.hasOwnProperty( 'parseCookie' ) ) {
            current.parseCookie = true
        }

        current.acceptsDefault = config.acceptsDefault || defaultHeaders.acceptsDefault
        current.defaultContentType = config.defaultContentType || defaultHeaders.defaultContentType

        content.initContentHandlers(config.contentHandlers||{}, current.acceptsDefault)
        current.resolveWithoutExtension = current.resolveWithoutExtension || []
        if( !Array.isArray( current.resolveWithoutExtension ) ) {
            current.resolveWithoutExtension = [current.resolveWithoutExtension]
        }

        if( current.resolveWithoutExtension.indexOf( '.htm' ) === -1 ) {
            current.resolveWithoutExtension.push( '.htm' )
        }
        if( current.resolveWithoutExtension.indexOf( '.html' ) === -1 ) {
            current.resolveWithoutExtension.push( '.html' )
        }

        if( current.middleware ) {
            validateMiddleware( current.middleware )
        }

        if( !current.hasOwnProperty( 'logAccess' ) ) {
            current.logAccess = true
        }
        log.setLogAccess( current.logAccess )
        if( current.hasOwnProperty( 'logLevel' ) ) {
            log.setLogLevel( current.logLevel )
        }
        current.port = config.port || 10420
    }
}