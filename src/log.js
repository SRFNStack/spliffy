const inspect = require( 'util' ).inspect
const format = (args, level) => {
    return `[${new Date().toISOString()}] [${level}]  ${args.map( a => typeof a === 'string' ? a : inspect( a, { depth: null } ) ).join( ' ' )}`
}
module.exports = {
    warning( e ) {
        console.warn(format([...arguments], 'WARN'))
    },
    info( e ) {
        console.info(format([...arguments], 'INFO'))
    },
    access( e ) {
        console.info(format([...arguments], 'ACCESS'))
    },
    error( e ) {
        console.error(format([...arguments], 'ERROR'))
    }
}