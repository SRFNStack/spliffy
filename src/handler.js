const log = require( './log' )
const serverConfig = require( './serverConfig' )
const content = require( './content' )
const { executeMiddleware } = require( "./middleware" );
const { decorateResponse } = require( './expressShim.js' )
const { decorateRequest } = require( './expressShim.js' )
const uuid = require( 'uuid' ).v4
const { Readable } = require( 'stream' )

/**
 * Execute the handler
 * @param url The url being requested
 * @param res The uws response object
 * @param req The uws request object
 * @param body The request body
 * @param handler The handler function for the route
 * @param middleware The middleware that applies to this request
 */
const executeHandler = async ( url, res, req, body, handler, middleware ) => {
    try {
        if( body )
            body = content.deserialize( body, req.headers['content-type'] )
    } catch( e ) {
        log.error( 'Failed to parse request.', e )
        end( res, 400, 'Failed to parse request body' )
        return
    }

    try {
        let handled = handler(
            {
                url,
                body,
                headers: req.headers,
                req,
                res
            } )
        if( handled && typeof handled.then == 'function' ) {
            await handled.then( ( h ) => finalizeResponse( req, res, h ) )
                .catch(
                    e => {
                        let refId = uuid()
                        log.error( 'handler failed', e, refId )
                        endError( res, e, refId )
                    }
                )
        } else {
            finalizeResponse( req, res, handled )
        }

    } catch( e ) {
        let refId = uuid()
        log.error( 'handler failed', e, refId )
        await tryExecuteMiddleware( middleware, req, res, e, refId )
        endError( res, e, refId )
    }
}

const endError = ( res, e, refId ) => {
    if( e.body && typeof e.body !== 'string' ) {
        e.body = JSON.stringify( e.body )
    }
    if( serverConfig.current.errorTransformer ) {
        e = serverConfig.current.errorTransformer( e, refId )
    }
    end( res, e.statusCode || e.status || 500, ( e.statusMessage || e.message || 'Internal Server Error' ) + ' refId: ' + refId, e.body || '' )
}

const end = ( res, code, message, body ) => {
    if( !res.statusCode ) res.statusCode = code
    if( !res.statusMessage ) res.statusMessage = message
    if( body instanceof Readable ) {
        streamResponse( res, body )
    } else {
        res.end( serializeBody( body, res ) || '' )
    }
}

const logAccess = function( req, res ) {
    const start = new Date().getTime()
    return () => {
        log.access( req.remoteAddress, res.proxiedRemoteAddress || '', res.statusCode, req.method, req.url, new Date().getTime() - start + 'ms' )
    }
}

const finalizeResponse = ( req, res, handled ) => {
    if( !res.finalized ) {
        res.finalized = true
        if( !handled ) {
            //if no error was thrown, assume everything is fine. Otherwise each handler must return truthy which is un-necessary for methods that don't need to return anything
            end( res, 200, 'OK' )
        } else {
            if( handled.body || handled.status || handled.statusMessage || handled.statusCode || handled.headers ) {
                if( handled.headers ) {
                    res.assignHeaders( handled.headers )
                }
                end( res, handled.statusCode || 200, handled.statusMessage || 'OK', handled.body )
            } else {
                end( res, 200, 'OK', handled )
            }
        }
    }
}

function onAbortedOrFinishedResponse( res, readStream ) {
    if( res.id === -1 ) {
        log.error( "ERROR! onAbortedOrFinishedResponse called twice for the same res!" )
    } else {
        readStream.destroy();
    }
    res.id = -1;
}

function toArrayBuffer( buffer ) {
    return buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength );
}

const streamResponse = ( res, readStream ) => {
    let totalSize = res.getHeader( 'content-length' );
    if( !totalSize ) {
        throw new Error( 'the Content-Length header must be set when responding with a stream body' )
    }
    totalSize = parseInt( totalSize )
    if( totalSize <= 0 ) {
        readStream.close()
        res.end( '' )
        return
    }
    //borrowed from https://github.com/uNetworking/uWebSockets.js/blob/8ba1edc0bbd05f97f6b1c8a03fd93be89bec458d/examples/VideoStreamer.js#L38
    readStream.on( 'data', chunk => {
        const ab = toArrayBuffer( chunk );
        let lastOffset = res.getWriteOffset();
        let [ok, done] = res.tryEnd( ab, totalSize );
        if( done ) {
            onAbortedOrFinishedResponse( res, readStream );
            res.writableEnded = true
            res.end()
        } else if( !ok ) {
            readStream.pause();
            res.ab = ab;
            res.abOffset = lastOffset;
            res.onWritable( ( offset ) => {
                let [ok, done] = res.tryEnd( res.ab.slice( offset - res.abOffset ), totalSize );
                if( done ) {
                    onAbortedOrFinishedResponse( res, readStream );
                    res.writableEnded = true
                    res.end()
                } else if( ok ) {
                    readStream.resume();
                }
                return ok;
            } );
        }
    } )
        .on( 'error', e => endError( res, e, uuid() ) )
}

const serializeBody = ( body, res ) => {
    let contentType = res.getHeader( 'content-type' )
    if( typeof body === 'string' ) {
        if( !contentType ) {
            res.headers['content-type'] = 'text/plain'
        }
        return body
    } else if( body instanceof Readable ) {
        return body
    }
    let serialized = content.serialize( body, contentType )

    if( serialized && serialized.contentType && !contentType ) {
        res.headers['content-type'] = serialized.contentType
    }
    return serialized && serialized.data || ''
}

async function tryExecuteMiddleware( middleware, req, res, e, refId ) {
    if( !middleware ) return

    let applicableMiddleware = middleware[req.method]
    if( middleware.ALL ) {
        if( applicableMiddleware ) applicableMiddleware = middleware.ALL.concat( applicableMiddleware )
        else applicableMiddleware = middleware.ALL
    }

    if( !applicableMiddleware || applicableMiddleware.length === 0 ) {
        return
    }
    const errorMiddleware = applicableMiddleware.filter( mw => mw.length === 4 )
    const middlewarez = applicableMiddleware.filter( mw => mw.length === 3 )
    try {
        if( e )
            await executeMiddleware( middlewarez, errorMiddleware, req, res, e )
        else
            await executeMiddleware( middlewarez, errorMiddleware, req, res )
    } catch( e ) {
        if( !refId ) refId = uuid()
        console.log( 'Failed executing middleware while handling error: ' + e )
        endError( res, e, refId )
    }
}

let currentDate = new Date().toUTCString()
setInterval( () => currentDate = new Date().toUTCString(), 1000 )

const handleRequest = async ( req, res, handler, middleware, pathParameters ) => {
    res.headers['server'] = 'uWebSockets.js'
    res.headers['date'] = currentDate
    try {
        let buffer
        let reqBody = await new Promise(
            resolve =>
                res.onData( async ( data, isLast ) => {
                    if( isLast ) {
                        buffer = data.byteLength > 0 ? Buffer.concat( [buffer, Buffer.from( data )].filter( b => b ) ) : buffer
                        resolve( buffer )
                    }
                    buffer = Buffer.concat( [buffer, Buffer.from( data )].filter( b => b ) )
                } )
        )
        await tryExecuteMiddleware( middleware, req, res )
        if( !res.writableEnded ) {
            await executeHandler( req.spliffyUrl, res, req, reqBody, handler, middleware )
        }
    } catch( e ) {
        let refId = uuid()
        log.error( 'Handling request failed', e, refId )
        await tryExecuteMiddleware( middleware, req, res, e, refId );
        if( !res.writableEnded )
            endError( res, e, refId )
    }
}
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'CONNECT', 'TRACE']
module.exports =
    {
        create: ( handler, middleware, pathParameters ) => function( res, req ) {
            try {
                req = decorateRequest( req, pathParameters, res );
                res = decorateResponse( res, req, finalizeResponse );

                if( serverConfig.current.logAccess ) {
                    res.onEnd = logAccess( req, res )
                }
                handleRequest( req, res, handler, middleware, pathParameters )
            } catch( e ) {
                log.error( 'Failed handling request', e )
            }
        },
        notFound: ( res, req ) => {
            try {
                let params = serverConfig.current.defaultRoute && serverConfig.current.defaultRoute.pathParameters || []
                req = decorateRequest( req, params, res );
                res = decorateResponse( res, req, finalizeResponse );
                if( serverConfig.current.logAccess ) {
                    res.onEnd = logAccess( req, res )
                }
                if(serverConfig.current.defaultRoute && typeof serverConfig.current.defaultRoute){
                    let route = serverConfig.current.defaultRoute
                    if(route.handlers && route.handlers[req.method]){
                        handleRequest(req, res, serverConfig.current.defaultRoute.handlers[req.method])
                    } else {
                        res.statusCode = 405
                        res.statusMessage = 'Method Not Allowed'
                        res.end()
                    }
                } else {
                    res.statusCode = 404
                    res.statusMessage = 'Not Found'
                    res.end()
                }
            } catch( e ) {
                log.error( 'Failed handling request', e )
            }
        },
        HTTP_METHODS
    }
