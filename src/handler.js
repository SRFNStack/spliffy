const log = require( './log' )
const content = require( './content' )
const { executeMiddleware } = require( "./middleware" );
const { decorateResponse } = require( './decorator.js' )
const { decorateRequest } = require( './decorator.js' )
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
 * @param errorTransformer An errorTransformer to convert error objects into response data
 */
const executeHandler = async ( url, res, req, body, handler, middleware, errorTransformer ) => {
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
                        endError( res, e, refId, errorTransformer )
                    }
                )
        } else {
            finalizeResponse( req, res, handled )
        }

    } catch( e ) {
        let refId = uuid()
        log.error( 'handler failed', e, refId )
        await tryExecuteMiddleware( middleware, req, res, e, errorTransformer, refId )
        endError( res, e, refId, errorTransformer )
    }
}

const endError = ( res, e, refId, errorTransformer ) => {
    if( e.body && typeof e.body !== 'string' ) {
        e.body = JSON.stringify( e.body )
    }
    if( typeof errorTransformer === 'function' ) {
        e = errorTransformer( e, refId )
    }
    end( res, e.statusCode || 500, ( e.statusMessage || 'Internal Server Error' ) + ' refId: ' + refId, e.body || '' )
}

const end = ( res, code, message, body ) => {
    //status set directly on res wins
    res.statusCode = res.statusCode || code
    res.statusMessage = res.statusMessage || message
    if( body instanceof Readable || res.streaming ) {
        res.streaming = true
        if( body instanceof Readable ) {
            res.flushHeaders()
            pipeResponse( res, body )
        }
        //handler is responsible for ending the response if they are streaming
    } else {
        res.end( serializeBody( body, res ) || '' )
    }
}

const writeAccess = function( req, res ) {
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
            //if the returned object has known fields, treat it as a response object instead of the body
            if( handled.body || handled.statusMessage || handled.statusCode || handled.headers ) {
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

const pipeResponse = ( res, readStream, errorTransformer ) => {
    readStream.on( 'data', res.write )
        .on( 'end', res.end )
        .on( 'error', e => {
            try {
                readStream.destroy()
            } finally {
                endError( res, e, uuid(), errorTransformer )
            }
        } )
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

async function tryExecuteMiddleware( middleware, req, res, e, errorTransformer, refId ) {
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
        endError( res, e, refId, errorTransformer )
    }
}

let currentDate = new Date().toUTCString()
setInterval( () => currentDate = new Date().toUTCString(), 1000 )

const handleRequest = async ( req, res, handler, middleware, errorTransformer ) => {
    res.headers['server'] = 'uWebSockets.js'
    res.headers['date'] = currentDate

    try {
        let reqBody
        if( !handler.streamRequestBody ) {
            let buffer
            reqBody = await new Promise(
                resolve =>
                    res.onData( async ( data, isLast ) => {
                        if( isLast ) {
                            buffer = data.byteLength > 0 ? Buffer.concat( [buffer, Buffer.from( data )].filter( b => b ) ) : buffer
                            resolve( buffer )
                        }
                        buffer = Buffer.concat( [buffer, Buffer.from( data )].filter( b => b ) )
                    } )
            )
        } else {
            reqBody = new Readable( {
                read: () => {
                }
            } )
            res.onData( async ( data, isLast ) => {
                if( data.byteLength === 0 && !isLast ) return
                //data must be copied so it isn't lost
                reqBody.push( Buffer.concat( [Buffer.from( data )] ) )
                if( isLast ) {
                    reqBody.push( null )
                }
            } )
        }
        await tryExecuteMiddleware( middleware, req, res, errorTransformer )
        if( !res.writableEnded && !res.ended ) {
            await executeHandler( req.spliffyUrl, res, req, reqBody, handler, middleware, errorTransformer )
        }
    } catch( e ) {
        let refId = uuid()
        log.error( 'Handling request failed', e, refId )
        await tryExecuteMiddleware( middleware, req, res, e, errorTransformer, refId );
        if( !res.writableEnded )
            endError( res, e, refId, errorTransformer )
    }
}
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'CONNECT', 'TRACE']
module.exports =
    {
        create: ( handler, middleware, pathParameters, config ) => function( res, req ) {
            try {
                req = decorateRequest( req, pathParameters, res, config );
                res = decorateResponse( res, req, finalizeResponse, config.errorTransformer, endError );

                if( config.logAccess ) {
                    res.onEnd = writeAccess( req, res )
                }
                handleRequest( req, res, handler, middleware, config.errorTransformer )
            } catch( e ) {
                log.error( 'Failed handling request', e )
            }
        },
        notFound: config => ( res, req ) => {
            try {
                let params = config.defaultRoute && config.defaultRoute.pathParameters || []
                req = decorateRequest( req, params, res, config );
                res = decorateResponse( res, req, finalizeResponse );
                if( config.logAccess ) {
                    res.onEnd = writeAccess( req, res )
                }
                if( config.defaultRoute && typeof config.defaultRoute ) {
                    let route = config.defaultRoute
                    if( route.handlers && route.handlers[req.method] ) {
                        handleRequest( req, res,
                            config.defaultRoute.handlers[req.method],
                            config.defaultRoute.middleware,
                            config.errorTransformer
                        )
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
