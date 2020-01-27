const parseUrl = require( './parseUrl' )
const log = require( './log' )
const HTTP_METHODS = [ 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD' ]
const serverConfig = require( './serverConfig' )
const routes = require( './routes' )
const content = require( './content' )
const cookie = require( 'cookie' )

const setCookie = (res) => function(){return  res.setHeader( 'set-cookie', [ ...( res.getHeader( 'set-cookie' ) || [] ), cookie.serialize( ...arguments ) ] )}

const handle = ( url, res, req, body, handler, routeInfo, handlerInfo, filterInjected ) => {
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
                ...filterInjected,
                setCookie: setCookie(res),
                url, body, headers: req.headers, req, res, routeInfo, handlerInfo
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
    if( typeof e.body !== 'string' ) {
        e.body = JSON.stringify( e.body )
    }
    end( res, e.statusCode || 500, e.statusMessage || 'Internal Server Error', e.body || '' )
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
    if( res.writable && !res.finished ) {
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

const handleRequest = async ( req, res ) => {
    let url = parseUrl( req.url )
    req.cookies = req.headers.cookie && cookie.parse( req.headers.cookie ) || {}
    let route = routes.find( url )
    if(!route.handler && serverConfig.current.notFoundRoute) {
        route = routes.find(parseUrl(serverConfig.current.notFoundRoute))
    }
    if( !route.handler ) {
        end( res, 404, 'Not Found' )
    } else if( req.method === 'OPTIONS' || ( route.handler && route.handler[ req.method ] ) ) {
        try {
            let reqBody = ''
            req.on( 'data', data => reqBody += String( data ) )
            req.on( 'end', async () => {
                url.pathParameters = route.pathParameters
                let filterInjected = {}
                if( serverConfig.current.filters ) {
                    for( let filter of serverConfig.current.filters ) {
                        const result = await filter( {
                                                   ...filterInjected,
                                                   url,
                                                   req,
                                                   reqBody,
                                                   res,
                                                   handler: route.handler,
                                                   routeInfo: route.routeInfo,
                                                   handlerInfo: route.handler.handlerInfo,
                                                   setCookie: setCookie(res)
                                               } )
                        if( result ) {
                            if( typeof result !== 'object' || Array.isArray( result ) ) throw 'filters must return objects.'
                            filterInjected = { ...filterInjected, ...result }
                        }
                        if( res.finished ) break
                    }
                }
                if( req.method === 'OPTIONS' ) {
                    res.setHeader( 'Allow', Object.keys( route.handler ).filter( key => HTTP_METHODS.indexOf( key ) > -1 ).join( ', ' ) )
                    end( res, 204 )
                } else {
                    if( !res.finished ) {
                        handle( url, res, req, reqBody, route.handler, route.routeInfo, route.handler.handlerInfo, filterInjected )
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