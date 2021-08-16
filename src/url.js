
module.exports = {
    parseQuery: ( query, decodeQueryParams ) => {
        let parsed = {}
        if( query ) {
            if( decodeQueryParams ) {
                query = decodeURIComponent( query.replace( /\+/g, '%20' ) )
            }
            for(let param of query.split('&')){
               let eq = param.indexOf('=')
               module.exports.setMultiValueKey(parsed, param.substr(0, eq), param.substr(eq+1))
            }
        }
        return parsed
    },
    setMultiValueKey: ( obj, key, value ) => {
        if( obj.hasOwnProperty(key) ) {
            if( !Array.isArray( obj[key] ) ) {
                obj[key] = [obj[key]]
            }
            obj[key].push( value )
        } else {
            obj[key] = value
        }
    }
}