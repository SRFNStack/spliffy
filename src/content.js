const serverConfig = require( './serverConfig' )

const contentHandlers = {
    'application/json': {
        read: s => JSON.parse( s ),
        write: s => JSON.stringify( s )
    },
    '*/*': {
        read: o => {
            if( typeof o === 'string' ) {
                try {
                    return JSON.parse( o )
                } catch(e) {}
            }
            return o && o.toString()
        },
        write: o => typeof o === 'object' ? JSON.stringify( o ) : o && o.toString()
    }
}
module.exports = {
    handle( content, contentTypeHeader, direction ) {
        if( content && content.length > 0 && contentTypeHeader ) {
            for( let contentType of contentTypeHeader.split( ',' ) ) {
                contentType = contentType && contentType.toLowerCase().split(";")[0]
                if( contentHandlers[ contentType ] && typeof contentHandlers[ contentType ][ direction ] === 'function' ) {
                    return { contentType: contentType, content: contentHandlers[ contentType ][ direction ]( content ) }
                }
            }

        }
        return { content: contentHandlers[ serverConfig.current.acceptsDefault ][ direction ]( content ) }
    },
    contentHandlers
}