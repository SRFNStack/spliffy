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
    'Is it getting hot in here?',
    'Ouch...',
    'Not feeling so good',
    'Look a squirrel!',
    'I swear I only had 3',
    'I see a light...',
    'Totally zooted',
    'Where are my pants?',
    'Somebody, anyone, help!',
    'What was I doing again?',
    'Wait, I swear, I didn\'t...',
    'Leeeeerrrooooyyy Jeeenkins',
    'At least I have chicken'
]

module.exports = {
    current,
    randomNonsense: () => `~[CRASH]{${nonsense[Math.floor( Math.random() * nonsense.length )]}}~`,
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