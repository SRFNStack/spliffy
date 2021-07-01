const serverConfig = require( './serverConfig' )

const contentHandlers = {
    'application/json': {
        deserialize: s => JSON.parse( s ),
        serialize: s => JSON.stringify( s )
    },
    '*/*': {
        deserialize: o => {
            if( typeof o === 'string' ) {
                try {
                    return JSON.parse( o )
                } catch( e ) {
                }
            }
            return o && o.toString()
        },
        serialize: o => typeof o === 'object' ? JSON.stringify( o ) : o && o.toString()
    }
}

function getHandler( contentType ) {
    //content-type should be singular https://greenbytes.de/tech/webdav/rfc2616.html#rfc.section.14.17
    let handler = contentHandlers[contentType];
    if( contentType
        && handler
        && typeof handler
    ) {
        if( typeof handler.serialize !== 'function' ) {
            throw new Error( `Content handlers must provide a serialize function. ${handler}` )
        }
        if( typeof handler.deserialize !== 'function' ) {
            throw new Error( `Content handlers must provide a deserialize function. ${handler}` )
        }
        return handler
    }
    return contentHandlers[ serverConfig.current.acceptsDefault ]
}

module.exports = {
    serialize( content, contentType ) {
        return getHandler( contentType ).serialize( content )
    },
    deserialize( content, contentType ) {
        return getHandler( contentType ).deserialize( content )
    },
    contentHandlers
}
