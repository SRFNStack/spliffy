const path = require( 'path' )
const childProcess = require( 'child_process' )

let server

module.exports = {
    start: async () => new Promise( ( resolve, reject ) => {
        console.log( "Starting spliffy server" )
        const timeout = 5_000
        const rejectTimeout = setTimeout( () => {
            reject( `Server was not initialized within ${timeout}ms` )
        }, timeout )
        server = childProcess.spawn( 'node', [path.resolve( path.join( __dirname, 'example', 'serve.js' ) )] )
        server.on( 'error', err => {
            console.log( "got error from server", err )
            clearTimeout( rejectTimeout )
            reject( err )
        } )
        server.on( 'exit', ( code ) => {
            clearTimeout( rejectTimeout )
            if( code === 0 ) {
                resolve()
            } else {
                reject( "Server exited with status: " + code )
            }
        } )
        server.stdout.setEncoding( 'utf-8' )
        server.stdout.on( 'data', data => {
            console.log( data )
            if( data.match( 'Server initialized' ) ) {
                clearTimeout( rejectTimeout )
                resolve()
            }
        } )
        server.stderr.setEncoding( 'utf-8' )
        server.stderr.on( 'data', console.error )
    } ),
    stop: async ()=> server.kill()
}