const parseUrl = require( './parseUrl' )
const log = require( './log' )
const HTTP_METHODS = [ 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD' ]
const serverConfig = require( './serverConfig' )
const routes = require( './routes' )
const content = require( './content' )
const cookie = require( 'cookie' )

const setCookie = ( res ) => function() {return res.setHeader( 'set-cookie', [ ...( res.getHeader( 'set-cookie' ) || [] ), cookie.serialize( ...arguments ) ] )}

/**
 * Actually handle an incoming request
 * @param url The url being requested
 * @param res The node response object
 * @param req The node request object
 * @param body The request body
 * @param handler The handler for the route
 */
const handle = ( url, res, req, body, handler ) => {
    try {
        body = content.handle( body, req.headers[ 'content-type' ], 'read' ).content
    } catch(e) {
        log.error( 'Failed to parse request.', e )
        end( res, 400, 'Failed to parse request body' )
        return
    }

    try {
        let handled = handler[ req.method ](
            {
                setCookie: setCookie( res ),
                url,
                body,
                headers: req.headers,
                req,
                res
            } )
        if( !handled ) {
            end( res, 500, 'OOPS' )
        } else if( handled.then && typeof handled.then == 'function' ) {
            handled.then( ( h ) => finalizeResponse( req, res, h ) )
                   .catch(
                       e => {
                           log.error( e )
                           handleError( res, e )
                       }
                   )
        } else {
            finalizeResponse( req, res, handled )
        }

    } catch(e) {
        log.error( 'handler failed', e )
        handleError( res, e )
    }
}

const handleError = ( res, e ) => {
    if( e.body && typeof e.body !== 'string' ) {
        e.body = JSON.stringify( e.body )
    }
    end( res, e.statusCode || e.status || 500, e.statusMessage || e.message || 'Internal Server Error', e.body || '' )
}

const end = ( res, code, message, body ) => {
    res.statusCode = code
    res.statusMessage = message
    res.end( body )
}

const logAccess = function( req, res ) {
    const start = new Date().getTime()
    res.on( 'finish', () => {
        log.access( req.connection.remoteAddress, res.statusCode, req.method, req.url, new Date().getTime() - start + 'ms' )
    } )
}

const finalizeResponse = ( req, res, handled ) => {
    if( res.writable ) {
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
                    Object.entries( handled.headers )
                          .forEach( ( [ k, v ] ) => res.setHeader( k, v ) )
                }
                code = handled.statusCode || 200
                message = handled.statusMessage || 'OK'
            }

            let contentType = req.headers[ 'accept' ] || res.getHeader( 'content-type' )

            let handledContent = content.handle( body, contentType, 'write' )
            let resBody = handledContent.content
            if( handledContent.contentType ) {
                res.setHeader( 'content-type', handledContent.contentType )
            }
            end( res, code, message, resBody )
        }
    }
}

async function executeMiddleware( middlewarez, req, res ) {
    await new Promise( ( resolve ) => {
        let current = -1
        const next = ( err ) => {
            if( err ) {
                handleError( res, err )
                resolve()
            }
            current++
            if( current === middlewarez.length ) {
                resolve()
            } else {
                setTimeout( () => middlewarez[ current ]( req, res, next ), 0 )
            }
        }

        next()
    } )

}

const handleRequest = async( req, res ) => {
    let url = parseUrl( req.url )
    req.cookies = req.headers.cookie && cookie.parse( req.headers.cookie ) || {}
    let route = routes.find( url )
    if( !route.handler && serverConfig.current.notFoundRoute ) {
        route = routes.find( parseUrl( serverConfig.current.notFoundRoute ) )
    }
    if( !route.handler ) {
        end( res, 404, 'Not Found' )
    } else if( req.method === 'OPTIONS' || ( route.handler && route.handler[ req.method ] ) ) {
        try {
            let reqBody = ''
            req.on( 'data', data => reqBody += String( data ) )
            req.on( 'end', async() => {
                url.pathParameters = route.pathParameters
                await executeMiddleware( route.middleware, res, req )
                if( res.writable ) {
                    if( req.method === 'OPTIONS' ) {
                        res.setHeader( 'Allow', Object.keys( route.handler ).filter( key => HTTP_METHODS.indexOf( key ) > -1 ).join( ', ' ) )
                        end( res, 204 )
                    } else {

                        handle( url, res, req, reqBody, route.handler )
                    }
                }
            } )
        } catch(e) {
            log.error( 'Handling request failed', e )
            handleError( res, e )
        }
    } else {
        end( res, 405, 'Method Not Allowed' )
    }
}

module.exports =
    ( req, res ) => {
        try {
            logAccess( req, res )
            return handleRequest( req, res )
        } catch(e) {
            log.error( 'Failed to request' )
        }
    }