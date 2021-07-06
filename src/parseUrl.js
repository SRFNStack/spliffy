const serverConfig = require('./serverConfig')

module.exports = (path, query) => {
    let parsedUrl = { path: path, query: {} }
    if( query ) {
        let nextParam = query.indexOf( '&' )
        let kvs = []
        do {
            let eq = query.indexOf( '=' )
            let paramValue = query.substr( eq + 1, nextParam > -1 ? nextParam - eq - 1 : undefined )
            let paramKey = query.substr( 0, eq )
            if( serverConfig.current.decodeQueryParameters ) {
                [ paramValue, paramKey ] = [ paramValue, paramKey ]
                    .map( component => decodeURIComponent( component.replace( /\+/g, '%20' ) ) )
            }
            kvs.push( [ paramKey, paramValue ] )
            if( nextParam > -1 ) {
                query = query.substr( nextParam + 1 )
                nextParam = query.indexOf( '&' )
            } else {
                break
            }
        } while( query.length > 0 )
        parsedUrl.query = kvs.reduce( ( query, kvPair ) => {
            if( query[ kvPair[ 0 ] ] ) {
                if( !Array.isArray( query[ kvPair[ 0 ] ] ) ) {
                    query[ kvPair[ 0 ] ] = [ query[ kvPair[ 0 ] ] ]
                }
                query[ kvPair[ 0 ] ].push( kvPair[ 1 ] )
            } else {
                query[ kvPair[ 0 ] ] = kvPair[ 1 ]
            }
            return query
        }, {} )
    }
    return parsedUrl
}