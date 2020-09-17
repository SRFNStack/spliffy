const inspect = require( 'util' ).inspect
const serverConfig = require('./serverConfig')

const ifLevelEnabled = (fn, level, args) =>{
    const configLevel = levelOrder[serverConfig.current.logLevel] || levelOrder.INFO
    if(!levelOrder[level] || levelOrder[level] >= configLevel){
        fn(`[${new Date().toISOString()}] [${level}]  ${args.map( a => typeof a === 'string' ? a : inspect( a, { depth: null } ) ).join( ' ' )}`)
    }
}

const levelOrder = {DEBUG: 0,INFO: 1, WARN: 2, ERROR: 3}

module.exports = {
    warning( e ) {
        ifLevelEnabled(console.warn, 'WARN',[...arguments])
    },
    info( e ) {
        ifLevelEnabled(console.info, 'INFO',[...arguments])
    },
    gne(e) {
      ifLevelEnabled(console.info,  'GOOD NEWS EVERYONE!', [...arguments])
    },
    access( e ) {
        if(serverConfig.current.logAccess) {
            ifLevelEnabled(console.info, 'ACCESS',[...arguments])
        }
    },
    error( e ) {
        ifLevelEnabled(console.error, 'ERROR',[...arguments].map(arg=> arg.stack ? arg.stack : arg))
    }
}