const contentTypes = require( './content-types.js' )
const { parseQuery } = require( "./url" );
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

let toFormData = ( key, value ) => {
    if( Array.isArray( value ) ) {
        return value.map( toFormData ).flat()
    } else if( typeof value === 'object' ) {
        return Object.keys( value ).map( k => toFormData( `${key}.${k}`, value[k] ) ).flat()
    } else {
        return `${encodeURIComponent( key )}=${encodeURIComponent( value )}`
    }
};

const contentHandlers = {
    'application/json': {
        deserialize: s => JSON.parse( s && s.toString() ),
        serialize: o => JSON.stringify( o )
    },
    'text/plain': {
        deserialize: s => s && s.toString(),
        serialize: o => o && o.toString()
    },
    'application/octet-stream': defaultHandler,
    'application/x-www-form-urlencoded': {
        deserialize: s => s && parseQuery( s.toString(), true ),
        serialize: o => Object.keys( o ).map( toFormData ).flat().join( '&' )
    },
    '*/*': defaultHandler,
}

let _acceptsDefault = '*/*'

function getHandler( contentType ) {
    if( !contentType ) return contentHandlers[_acceptsDefault]
    //content-type is singular https://greenbytes.de/tech/webdav/rfc2616.html#rfc.section.14.17
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
        return getHandler( contentType && contentType.toLowerCase() ).serialize( content )
    },
    deserialize( content, contentType ) {
        return getHandler( contentType && contentType.toLowerCase() ).deserialize( content )
    },
    initContentHandlers( handlers, acceptsDefault ) {
        Object.assign( handlers, contentHandlers )
        _acceptsDefault = acceptsDefault
    },
    getContentTypeByExtension
}
