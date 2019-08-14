const inspect = require( 'util' ).inspect
module.exports = {
    warning( e ) {
        const args = [ ...arguments ].map( a => inspect( a, { depth: null } ) ).join( ' ' )
        console.warn( `[Warn] [${new Date().toISOString()}] ${args}` )
    },
    error( e ) {
        const args = [ ...arguments ].map( a => inspect( a, { depth: null } ) ).join( ' ' )
        console.error( `[WTF] [${new Date().toISOString()}] ${args}` )
    }
}