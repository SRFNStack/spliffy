const path = require( 'path' )
const childProcess = require( 'child_process' )
const NodeEnvironment = require( 'jest-environment-node' )

module.exports = class extends NodeEnvironment {
    constructor( config ) {
        super( config )
        this.server = null
    }

    async setup() {
        await super.setup()
        const self = this
        await new Promise( ( resolve, reject ) => {
            const timeout = 5_000
            const rejectTimeout = setTimeout( () => {
                reject( `Server was not initialized within ${timeout}ms` )
            }, timeout )
            self.server = childProcess.spawn( 'node', [path.resolve( path.join( __dirname, 'example', 'serve.js' ) )] )
            self.server.on( 'error', err => {
                console.log( "got error from server", err )
                clearTimeout( rejectTimeout )
                reject( err )
            } )
            self.server.on( 'exit', ( code ) => {
                if( code === 0 ) {
                    resolve()
                } else {
                    reject( "Server exited with status: " + code )
                }
            } )
            self.server.stdout.setEncoding( 'utf-8' )
            self.server.stdout.on( 'data', data => {
                console.log( data )
                if( data.match( 'Server initialized' ) ) {
                    clearTimeout( rejectTimeout )
                    resolve()
                }
            } )
            self.server.stderr.setEncoding( 'utf-8' )
            self.server.stderr.on( 'data', console.error )
        } )
    }

    async teardown() {
        if( this.server ) this.server.kill()
        await super.teardown()
    }

}



