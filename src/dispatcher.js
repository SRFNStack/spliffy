const log = require( './log' )
const serverConfig = require( './serverConfig' )
const routes = require( './routes' )
const content = require( './content' )
const { executeMiddleware } = require( "./middleware" );
const { decorateResponse } = require( './expressShim.js' )
const { decorateRequest } = require( './expressShim.js' )
const { HTTP_METHODS } = require( './routes.js' )
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
        let handled = handler[req.method](
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
    if( !res.writableEnded ) {
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
                    res.assignHeaders(handled.headers)
                }
                code = handled.statusCode || 200
                message = handled.statusMessage || 'OK'
            }
            let contentType = res.getHeader( 'content-type' )

            end( res, code, message, content.serialize( body, contentType ) )
        }
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

const handleRequest = async ( req, res ) => {
    req = decorateRequest( req, res )
    res = decorateResponse( res, req, finalizeResponse )

    res.setHeader( 'server', 'node' )

    let route = routes.find( req.spliffyUrl )
    if( !route.handler && serverConfig.current.notFoundRoute ) {
        route = routes.find( parseUrl( serverConfig.current.notFoundRoute ) )
    }
    if( !route.handler ) {
        end( res, 404, 'Not Found' )
    } else if( req.method === 'OPTIONS' || ( route.handler && route.handler[req.method] ) ) {
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
            req.spliffyUrl.pathParameters = route.pathParameters
            await tryExecuteMiddleware( route.middleware, req, res )
            if( !res.writableEnded ) {
                if( req.method === 'OPTIONS' && !route.handler.OPTIONS ) {
                    res.setHeader( 'Allow', Object.keys( route.handler ).filter( key => HTTP_METHODS.indexOf( key ) > -1 ).join( ', ' ) )
                    end( res, 204 )
                } else {
                    await handle( req.spliffyUrl, res, req, reqBody, route.handler, route.middleware )
                }
            }
        } catch( e ) {
            let refId = uuid()
            log.error( 'Handling request failed', e, refId )
            await tryExecuteMiddleware( route.middleware, req, res, e, refId );
            if( !res.writableEnded )
                handleError( res, e, refId )
        }
    } else {
        end( res, 405, 'Method Not Allowed' )
    }
}

module.exports =
    function( res, req ) {
        try {
            if( serverConfig.current.logAccess ) {
                let onComplete = logAccess( req, res )
                handleRequest( req, res )
                    .then( result => {
                        onComplete()
                        return result
                    } )
            } else {
                return handleRequest( req, res )
            }
        } catch( e ) {
            log.error( 'Failed handling request', e )
        }
    }
