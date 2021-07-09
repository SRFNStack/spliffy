const serverConfig = require( './serverConfig' )

module.exports = {
    parse: ( path, query ) => {
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

                    module.exports.setMultiValueKey( parsed.query, key, value )

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
    },
    setMultiValueKey: ( obj, key, value ) => {
        if( obj[key] ) {
            if( !Array.isArray( obj[key] ) ) {
                obj[key] = [obj[key]]
            }
            obj[key].push( value )
        } else {
            obj[key] = value
        }
    }
}