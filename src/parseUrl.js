const serverConfig = require( './serverConfig' )

module.exports = ( path, query ) => {
    let parsed = { path: path, query: {} }
    if( query ) {
        if( serverConfig.current.decodeQueryParameters ) {
            query = decodeURIComponent( query.replace( /\+/g, '%20' ) )
        }
        let key = ''
        let value = ''
        let isKey = true

        for( let i = 0; i <= query.length; i++ ) {
            if( i === query.length || query[i] === '&' ) {
                //trailing or consecutive &
                if( key === '' && value === '' ) continue

                if( parsed.query[key] ) {
                    if( !Array.isArray( parsed.query[key] ) ) {
                        parsed.query[key] = [parsed.query[key]]
                    }
                    parsed.query[key].push( value )
                } else {
                    parsed.query[key] = value
                }

                key = ''
                value = ''
                isKey = true
            } else if( query[i] === '=' ) {
                isKey = false
            } else {
                if( isKey ) {
                    key += query[i]
                } else {
                    value += query[i]
                }
            }

        }
    }
    return parsed
}