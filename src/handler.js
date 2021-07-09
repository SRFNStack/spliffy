const log = require( './log' )
const serverConfig = require( './serverConfig' )
const content = require( './content' )
const { executeMiddleware } = require( "./middleware" );
const { decorateResponse } = require( './expressShim.js' )
const { decorateRequest } = require( './expressShim.js' )
const uuid = require( 'uuid' ).v4

/**
 * Actually handle an incoming request
 * @param url The url being requested
 * @param res The node response object
 * @param req The node request object
 * @param body The request body
 * @param handler The handler for the route
 * @param middleware The middleware that applies to this request
 */
const handle = async ( url, res, req, body, handler, middleware ) => {
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
        if( handled && handled.then && typeof handled.then == 'function' ) {
            await handled.then( ( h ) => finalizeResponse( req, res, h ) )
                .catch(
                    e => {
                        let refId = uuid()
                        log.error( e, refId )
                        handleError( res, e, refId )
                    }
                )
        } else {
            finalizeResponse( req, res, handled )
        }

    } catch( e ) {
        let refId = uuid()
        log.error( 'handler failed', e, refId )
        await tryExecuteMiddleware( middleware, req, res, e, refId )
        handleError( res, e, refId )
    }
}

const handleError = ( res, e, refId ) => {
    if( e.body && typeof e.body !== 'string' ) {
        e.body = JSON.stringify( e.body )
    }
    if( serverConfig.current.errorTransformer ) {
        e = serverConfig.current.errorTransformer( e, refId )
    }
    end( res, e.statusCode || e.status || 500, ( e.statusMessage || e.message || 'Internal Server Error' ) + ' refId: ' + refId, e.body || '' )
}

const end = ( res, code, message, body ) => {
    res.statusCode = code
    res.statusMessage = message
    res.end( body || '' )
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
            let code = 200
            let message = 'OK'
            let body = handled
            if( handled.body || handled.status || handled.statusMessage || handled.statusCode || handled.headers ) {
                body = handled.body
                if( handled.headers ) {
                    res.assignHeaders( handled.headers )
                }
                code = handled.statusCode || 200
                message = handled.statusMessage || 'OK'
            }
            let contentType = res.getHeader( 'content-type' )

            let serialized = content.serialize( body, contentType );
            if( serialized && serialized.contentType && !contentType ) {
                res.setHeader( 'content-type', serialized.contentType )
            }
            end( res, code, message, serialized && serialized.data || serialized )
        }
    } else {
        log.warn( `Tried to finalize ended response for req: ${req.url}` )
    }
}

async function tryExecuteMiddleware( middleware, req, res, e, refId ) {
    if( !middleware ) return
    try {
        if( e )
            await executeMiddleware( middleware, req, res, e )
        else
            await executeMiddleware( middleware, req, res )
    } catch( e ) {
        if( !refId ) refId = uuid()
        console.log( 'Failed executing middleware while handling error: ' + e )
        handleError( res, e, refId )
    }
}

let currentDate = new Date().toUTCString()
setInterval( () => currentDate = new Date().toUTCString(), 1000 )

const handleRequest = async ( req, res, handler, middleware, pathParameters ) => {
    req = decorateRequest( req, res )
    res = decorateResponse( res, req, finalizeResponse )

    res.setHeader( 'server', 'uws' )
    res.setHeader( 'date', currentDate )
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
        req.spliffyUrl.pathParameters = {}
        for(let i in pathParameters) {
            req.spliffyUrl.pathParameters[pathParameters[i]] = req.getParameter(i)
        }
        await tryExecuteMiddleware( middleware, req, res )
        if( !res.writableEnded ) {
            await handle( req.spliffyUrl, res, req, reqBody, handler, middleware )
        }
    } catch( e ) {
        let refId = uuid()
        log.error( 'Handling request failed', e, refId )
        await tryExecuteMiddleware( middleware, req, res, e, refId );
        if( !res.writableEnded )
            handleError( res, e, refId )
    }
}
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'CONNECT', 'TRACE']
module.exports =
    {
        create: ( handler, middleware, pathParameters ) => function( res, req ) {
            try {
                if( serverConfig.current.logAccess ) {
                    res.onEnd = logAccess( req, res )
                }
                handleRequest( req, res, handler, middleware, pathParameters )
            } catch( e ) {
                log.error( 'Failed handling request', e )
            }
        },
        HTTP_METHODS
    }
