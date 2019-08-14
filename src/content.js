const contentHandlers=  {
    'application/json': {
        read: s => JSON.parse( s ),
        write: s => JSON.stringify( s )
    },
    '*/*': {
        read: o => typeof o === 'object' ? JSON.parse( o ) : o && o.toString(),
        write: o => typeof o === 'object' ? JSON.stringify( o ) : o && o.toString()
    }
}
module.exports = {
    handle( content, contentTypeHeader, defaultType, direction ) {
        if( content && content.length > 0 && contentTypeHeader ) {
            for( let contentType of contentTypeHeader.split( ',' ) ) {
                contentType = contentType && contentType.toLowerCase()
                if( contentHandlers[ contentType ] && typeof contentHandlers[ contentType ][ direction ] === 'function' ) {
                    return { contentType: contentType, content: contentHandlers[ contentType ][ direction ]( content ) }
                }
            }

        }
        return { content: contentHandlers[ defaultType ][ direction ]( content ) }
    },
    contentHandlers
}