const ws = require( 'ws' )

require( '../src/index' )( require( './config' )( process.argv[ 1 ] || 'dev' ) ).then( server => {
    const wss = new ws.Server( { server } )
    wss.on( 'connection', ws => {
        console.log('Got websocket connection ', ws)
        ws.on( 'message', message => console.log( 'Got message ', message ) )

        function ping() {
            setTimeout( () => {
                ws.send( 'Server time ' + new Date().toISOString() )
                ping()
            }, 2000 )
        }
        ping()
    } )
} )