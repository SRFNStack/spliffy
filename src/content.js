const contentTypes = require( './content-types.js' )
let defaultHandler = {
    deserialize: o => {
        try {
            return JSON.parse( o && o.toString() )
        } catch( e ) {
            return o
        }
    },
    serialize: o => {
        if( typeof o === 'string' ) {
            return {
                contentType: 'text/plain',
                data: o
            }
        }
        if( o instanceof Buffer ) {
            return {
                contentType: 'application/octet-stream',
                data: o
            }
        }
        return {
            contentType: 'application/json',
            data: JSON.stringify( o )
        }
    }
};
const contentHandlers = {
    'application/json': {
        deserialize: s => JSON.parse( s && s.toString() ),
        serialize: s => JSON.stringify( s )
    },
    'text/plain': {
        deserialize: s => s && s.toString(),
        serialize: o => o && o.toString()
    },
    'application/octet-stream': defaultHandler,
    '*/*': defaultHandler,
}

let _acceptsDefault = '*/*'

function getHandler( contentType ) {
    if( !contentType ) return contentHandlers[_acceptsDefault]
    //content-type should be singular https://greenbytes.de/tech/webdav/rfc2616.html#rfc.section.14.17
    let handler = contentHandlers[contentType];
    if( !handler && contentType.indexOf( ';' ) > -1 ) {
        handler = contentHandlers[contentType.split( ';' )[0].trim()]
    }
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

function getContentTypeByExtension( name, staticContentTypes ) {
    const extension = name.indexOf( '.' ) > -1 ? name.slice( name.lastIndexOf( '.' ) ).toLowerCase() : 'default'
    let contentType = staticContentTypes && staticContentTypes[extension] || null

    return contentType ? contentType : contentTypes[extension]
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
    },
    getContentTypeByExtension
}
