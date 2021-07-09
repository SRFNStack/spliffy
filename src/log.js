const inspect = require( 'util' ).inspect
const levelOrder = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 4 }
let logAccess = true
let logLevel = levelOrder.INFO

const ifLevelEnabled = ( fn, level, args ) => {
    const configLevel = levelOrder[logLevel] || levelOrder.INFO
    if( !levelOrder[level] || levelOrder[level] >= configLevel ) {
        fn( `[${new Date().toISOString()}] [${level}]  ${args.map( a => typeof a === 'string' ? a : inspect( a, { depth: null } ) ).join( ' ' )}` )
    }
}

module.exports = {
    setLogAccess( enable ) {
        logAccess = !!enable
    },
    setLogLevel( level ) {
        if( !levelOrder.hasOwnProperty( level ) ) {
            throw `Invalid level: ${level}`
        }
        logLevel = level
    },
    warning( e ) {
        ifLevelEnabled( console.warn, 'WARN', [...arguments] )
    },
    warn( e ) {
        ifLevelEnabled( console.warn, 'WARN', [...arguments] )
    },
    info( e ) {
        ifLevelEnabled( console.info, 'INFO', [...arguments] )
    },
    gne( e ) {
        ifLevelEnabled( console.info, 'GOOD NEWS EVERYONE!', [...arguments] )
    },
    access( e ) {
        if( logAccess ) {
            ifLevelEnabled( console.info, 'ACCESS', [...arguments] )
        }
    },
    error( e ) {
        ifLevelEnabled( console.error, 'ERROR', [...arguments].map( arg => arg.stack ? arg.stack : arg ) )
    }
}
