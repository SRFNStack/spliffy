let defaultHandler = {
    deserialize: o => {
        try {
            return JSON.parse( typeof o === 'string' ? o : String( o ) )
        } catch( e ) {
            return o
        }
    },
    serialize: o => {
        if( o instanceof Buffer || typeof o === 'string' ) {
            return o
        }
        return {
            contentType: 'application/json',
            data: JSON.stringify( typeof o === 'object' ? o : o && o.toString() )
        }
    }
};
const contentHandlers = {
    'application/json': {
        deserialize: s => JSON.parse( typeof s === 'string' ? s : String( s ) ),
        serialize: s => JSON.stringify( s )
    },
    'application/octet-stream': defaultHandler,
    '*/*': defaultHandler
}

let _acceptsDefault = '*/*'

function getHandler( contentType ) {
    //content-type should be singular https://greenbytes.de/tech/webdav/rfc2616.html#rfc.section.14.17
    let handler = contentHandlers[contentType];
    if( handler && typeof handler ) {
        if( typeof handler.serialize !== 'function' ) {
            throw new Error( `Content handlers must provide a serialize function. ${handler}` )
        }
        if( typeof handler.deserialize !== 'function' ) {
            throw new Error( `Content handlers must provide a deserialize function. ${handler}` )
        }
        return handler
    }
    return contentHandlers[_acceptsDefault]
}

module.exports = {
    serialize( content, contentType ) {
        return getHandler( contentType ).serialize( content )
    },
    deserialize( content, contentType ) {
        return getHandler( contentType ).deserialize( content )
    },
    initContentHandlers( handlers, acceptsDefault ) {
        Object.assign( handlers, contentHandlers )
        _acceptsDefault = acceptsDefault
    }
}
