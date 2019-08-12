const fs = require( 'fs' )
const http = require( 'http' )
const path = require( 'path' )
const inspect = require( 'util' ).inspect
const contentTypes = require( './content-types.js' )

const HTTP_METHODS = [ 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD' ]

const contentHandlers = {
    'application/json': {
        read: s => JSON.parse( s ),
        write: s => JSON.stringify( s )
    },
    '*/*': {
        read: o => typeof o === 'object' ? JSON.parse( o ) : o && o.toString(),
        write: o => typeof o === 'object' ? JSON.stringify( o ) : o && o.toString()
    }
}
const defaults = {
    acceptsDefault: '*/*',
    defaultContentType: '*/*'
}

function logError( e ) {
    const args = [ ...arguments ].map( a => inspect( a, { depth: null } ) ).join( ' ' )
    console.error( `[WTF] [${new Date().toISOString()}] ${args}` )
}

const staticHandler = ( fullPath, fileName ) => {
    const extension = fileName.indexOf( '.' ) > -1 ? fileName.slice( fileName.lastIndexOf( '.' )).toLowerCase() : 'default'
    const contentType = contentTypes[ extension ]

    return {
        GET: ( { res } ) => {
            const stat = fs.statSync( fullPath )

            res.writeHead(200, {
                "content-type": contentType,
                "content-length": stat.size,
            })

            const stream = fs.createReadStream( fullPath ).pipe(res)
            return new Promise((resolve)=>{
                stream.on('finish', resolve)
            })
        }
    }
}

const findRoutes = ( routeDir ) => {
    let doIt = ( path ) => {
        let paths = {}

        for( let f of fs.readdirSync( path, { withFileTypes: true } ) ) {
            let route = {}

            let handlerName = f.name
            if( f.isDirectory() ) {
                route = doIt( path + '/' + f.name, f.name )
            } else if( f.name.endsWith( '.js' ) ) {
                let filePath = f.name === 'index.js' ? path + '/index.js' : path + '/' + f.name
                handlerName = f.name === 'index.js' ? 'index' : handlerName.substr( 0, f.name.length - 3 )
                route.handler = require( filePath )
            } else {
                handlerName = f.name.startsWith( 'index.' ) ? 'index' : handlerName
                route.handler = staticHandler( path+"/"+f.name, f.name )
            }
            if( handlerName.startsWith( '$' ) ) {
                route.key = handlerName.substr( 1 )
                if( 'variable' in paths ) {
                    throw `You can not have two path variables in the same dir. Conflicting handlers: \$${route.key} and \$${paths.variable.key}.`
                }
                handlerName = 'variable'
            } else if( handlerName.endsWith( '+' ) ) {
                route.catchall = true
                handlerName = handlerName.substr( 0, handlerName.length - 1 )
            }

            paths[ handlerName ] = route
            if(handlerName.endsWith(".html") || handlerName.endsWith(".htm")){
                paths[handlerName.split(".html")[0]] = route
            }
        }
        return paths
    }
    return doIt( routeDir, [] )
}

const parseUrl = url => {
    let queryStart = url.indexOf( '?' )
    let path = queryStart > -1 ? url.substr( 0, queryStart ) : url
    let parsedUrl = { path: path, query: {} }
    if( queryStart > -1 ) {
        let query = url.substr( queryStart + 1 )
        let nextParam = query.indexOf( '&' )
        let kvs = []
        do {
            let eq = query.indexOf( '=' )
            kvs.push( [ query.substr( 0, eq ), query.substr( eq + 1, nextParam > -1 ? nextParam - eq - 1 : undefined ) ] )
            if( nextParam > -1 ) {
                query = query.substr( nextParam + 1 )
                nextParam = query.indexOf( '&' )
            } else {
                break
            }
        } while( query.length > 0 )
        parsedUrl.query = kvs.reduce( ( query, kvPair ) => {
            if( query[ kvPair[ 0 ] ] ) {
                if( !Array.isArray( query[ kvPair[ 0 ] ] ) ) {
                    query[ kvPair[ 0 ] ] = [ query[ kvPair[ 0 ] ] ]
                }
                query[ kvPair[ 0 ] ].push( kvPair[ 1 ] )
            } else {
                query[ kvPair[ 0 ] ] = kvPair[ 1 ]
            }
            return query
        }, {} )
    }
    return parsedUrl
}

const logOnEnd = function( res, req ) {
    const start = new Date().getTime()
    res.on( 'finish', () => {
        console.log( '[', new Date().toISOString(), ']',
                     req.connection.remoteAddress, res.statusCode, req.method, req.url, new Date().getTime() - start + 'ms' )
    } )
}

const end = ( res, code, message, body ) => {
    res.statusCode = code
    res.statusMessage = message
    res.end( body )
}

const finalizeResponse = ( req, res ) => ( handled ) => {
    if( res.writable && !res.finished ) {
        if( !handled ) {
            end( res, 500, 'OOPS' )
        } else {
            let code = 200
            let message = 'OK'
            let body = handled
            if( handled.body ) {
                body = handled.body
                if( handled.headers ) {
                    Object.entries( handled.headers )
                          .forEach( ( [ k, v ] ) => res.setHeader( k, v ) )
                }
                code = handled.statusCode || 200
                message = handled.statusMessage || 'OK'
            }

            let contentType = req.headers[ 'accept' ] || res.getHeader( 'content-type' )

            let handledContent = handleRequestContent( body, contentType, defaults.defaultContentType, 'write' )
            let resBody = handledContent.content
            if( handledContent.contentType ) {
                res.setHeader( 'content-type', handledContent.contentType )
            }
            end( res, code, message, resBody )
        }
    }
}

const handleError = ( res, e ) => {
    if( typeof e.body !== 'string' ) {
        e.body = JSON.stringify( e.body )
    }
    end( res, e.statusCode || 500, e.statusMessage || 'Internal Server Error', e.body || '' )
}

const handleRequestContent = ( content, contentTypeHeader, defaultType, direction ) => {
    if( content && content.length > 0 && contentTypeHeader ) {
        for( let contentType in contentTypeHeader.split( ',' ) ) {
            contentType = contentType && contentType.toLowerCase()
            if( contentHandlers[ contentType ] && typeof contentHandlers[ contentType ][ direction ] === 'function' ) {
                return { contentType: contentType, content: contentHandlers[ contentType ][ direction ]( content ) }
            }
        }

    }
    return { content: contentHandlers[ defaultType ][ direction ]( content ) }
}

const handle = ( url, res, req, body, handler ) => {
    try {
        body = handleRequestContent( body, req.headers[ 'content-type' ], defaults.acceptsDefault, 'read' ).content
    } catch(e) {
        logError( 'Failed to parse request.', e )
        end( res, 400, 'Failed to parse request body' )
        return
    }

    try {
        let handled = handler[ req.method ]( { url, body, headers: req.headers, req, res } )
        if( handled.then && typeof handled.then == 'function' ) {
            handled.then( finalizeResponse( req, res ) )
                   .catch(
                       e => {
                           logError( e )
                           handleError( res, e )
                       }
                   )
        } else {
            finalizeResponse( req, res )( handled )
        }

    } catch(e) {
        logError( 'handler failed', e )
        handleError( res, e )
    }
}

const findRoute = ( url, routes, prefix ) => {
    let path = url.path.substr( 1 + ( prefix && prefix.length + 1 || 0 ) )
    if( path === '' || path === '/' ) path = 'index'
    let nextPart = path.indexOf( '/' )
    let handler = routes
    let pathParameters = {}
    do {
        let part = nextPart > -1 ? path.substr( 0, nextPart ) : path
        if( part in handler ) {
            handler = handler[ part ]
        } else if( handler.variable ) {
            pathParameters[ handler.variable.key ] = part
            handler = handler.variable || {}
        } else {
            handler = null
        }
        if( nextPart > -1 && ( handler && !handler.catchall ) ) {
            path = path.substr( nextPart + 1 )
            nextPart = path.indexOf( '/' )
            if(nextPart === -1){
                nextPart = path.indexOf(".") > -1? nextPart.length : -1
            }
        } else {
            break
        }
    } while( path.length > 0 )
    return {
        handler: handler && ( handler.handler || ( handler.index && handler.index.handler ) ),
        pathParameters: pathParameters
    }
}

const requestHandler = ( { routeDir, filters, routePrefix } ) => {
    let fullRouteDir = path.resolve( routeDir )
    const routes = findRoutes( fullRouteDir )
    return ( req, res ) => {
        logOnEnd( res, req )
        let url = parseUrl( req.url )
        let route = findRoute( url, routes, routePrefix )
        if( !route.handler ) {
            end( res, 404, 'Not Found' )
        } else if( req.method === 'OPTIONS' || ( route.handler && route.handler[ req.method ] ) ) {
            try {
                let reqBody = ''
                req.on( 'data', data => reqBody += String( data ) )
                req.on( 'end', () => {
                    url.pathParameters = route.pathParameters
                    if( filters ) {
                        for( let filter of filters ) {
                            filter( url, req, reqBody, res, route.handler )
                            if( res.finished ) break
                        }
                    }
                    if( req.method === 'OPTIONS' ) {
                        res.setHeader( 'Allow', Object.keys( route.handler ).filter( key => HTTP_METHODS.indexOf( key ) > -1 ).join( ', ' ) )
                        end( res, 204 )
                    } else {
                        if( !res.finished ) {
                            handle( url, res, req, reqBody, route.handler )
                        }
                    }
                } )
            } catch(e) {
                logError( 'Handling request failed', e )
                handleError( res, e )
            }
        } else {
            end( res, 405, 'Method Not Allowed' )
        }
    }
}

module.exports = config => {
    Object.assign( contentHandlers, config.contentHandlers )
    defaults.acceptsDefault = config.acceptsDefault || defaults.acceptsDefault
    defaults.defaultContentType = config.defaultContentType || defaults.defaultContentType
    let httpServer = http.createServer( requestHandler( config ) )
    let port = config.port || 10420
    httpServer.listen( port )
    console.log( `Server initialized at ${new Date().toISOString()} and listening on port ${port}` )
}