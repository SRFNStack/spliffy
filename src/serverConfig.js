const content = require( './content' )
const { validateMiddleware } = require( './middleware.js' )
const log = require( './log' )

const defaultHeaders = {
    acceptsDefault: '*/*',
    defaultContentType: '*/*'
}
//this is mainly for performance reason
const nonsense = [
    `I'm toasted`,
    'that hurt',
    'feels bad man :(',
    `squirrel! ~-{  }:>`,
    'your interwebs!',
    'I see a light...',
    `totally zooted`,
    'misplaced my bits',
    'maybe reboot?',
    'what was I doing again?',
    'my cabbages!!!',
    'Leeerrroooyyy Jeeenkins',
    'at least I have chicken'
]

module.exports = {
    randomNonsense: () => `[OH NO, ${nonsense[Math.floor( Math.random() * nonsense.length )]}]`,
    init( userConfig ) {
        const config = Object.assign( {}, userConfig )

        if( !config.hasOwnProperty( 'decodePathParameters' ) ) {
            config.decodePathParameters = true
        }

        if( !config.hasOwnProperty( 'parseCookie' ) ) {
            config.parseCookie = true
        }

        config.acceptsDefault = config.acceptsDefault || defaultHeaders.acceptsDefault
        config.defaultContentType = config.defaultContentType || defaultHeaders.defaultContentType

        content.initContentHandlers( config.contentHandlers || {}, config.acceptsDefault )
        config.resolveWithoutExtension = config.resolveWithoutExtension || []
        if( !Array.isArray( config.resolveWithoutExtension ) ) {
            config.resolveWithoutExtension = [config.resolveWithoutExtension]
        }

        if( config.resolveWithoutExtension.indexOf( '.htm' ) === -1 ) {
            config.resolveWithoutExtension.push( '.htm' )
        }
        if( config.resolveWithoutExtension.indexOf( '.html' ) === -1 ) {
            config.resolveWithoutExtension.push( '.html' )
        }

        if( config.middleware ) {
            validateMiddleware( config.middleware )
        }

        if( !config.hasOwnProperty( 'logAccess' ) ) {
            config.logAccess = true
        }
        log.setLogAccess( config.logAccess )
        if( config.hasOwnProperty( 'logLevel' ) ) {
            log.setLogLevel( config.logLevel )
        }
        if( !config.hasOwnProperty( 'ignoreFilesMatching' ) ) {
            config.ignoreFilesMatching = []
        } else if( !Array.isArray( config.ignoreFilesMatching ) ) {
            config.ignoreFilesMatching = [config.ignoreFilesMatching]
        }
        if( !config.hasOwnProperty( 'allowTestFileRoutes' ) ) {
            config.allowTestFileRoutes = false
        }
        config.port = config.port || 10420
        return config
    }
}