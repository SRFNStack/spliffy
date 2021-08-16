const cookie = require( 'cookie' )
const http = require( 'http' )
const { parseQuery, setMultiValueKey } = require( './url' )
const log = require( './log' )
const uuid = require( "uuid" ).v4;
const { Writable } = require( 'stream' )

const setCookie = ( res ) => function() {
    return res.setHeader( 'Set-Cookie', [...( res.getHeader( 'Set-Cookie' ) || [] ), cookie.serialize( ...arguments )] )
}
const addressArrayBufferToString = addrBuf => String.fromCharCode.apply( null, new Int8Array( addrBuf ) )
const excludedMessageProps = {
    setTimeout: true,
    _read: true,
    destroy: true,
    _addHeaderLines: true,
    _addHeaderLine: true,
    _dump: true,
    __proto__: true
}

const normalizeHeader = header => header.toLowerCase()

const reqProtoProps = () => Object.keys( http.IncomingMessage.prototype ).filter( p => !excludedMessageProps[p] )

/**
 * Provide a minimal set of shims to make most middleware, like passport, work
 * @type {{decorateResponse(*=, *=, *): *, decorateRequest(*): *}}
 */
module.exports = {
    setCookie,
    decorateRequest( uwsReq, pathParameters, res, {decodeQueryParameters, decodePathParameters, parseCookie} = {} ) {
        //uwsReq can't be used in async functions because it gets de-allocated when the handler function returns
        let req = {}
        //frameworks like passport like to modify the message prototype
        //Setting the prototype of req is not desirable because the entire api of IncomingMessage is not supported
        for( let p of reqProtoProps() ) {
            if( !req[p] ) req[p] = http.IncomingMessage.prototype[p]
        }
        let query = uwsReq.getQuery()
        req.path = uwsReq.getUrl()
        req.url = `${req.path}${query ? '?' + query : ''}`
        req.spliffyUrl = {
            path: uwsReq.getUrl(),
            query: parseQuery( uwsReq.getQuery(), decodeQueryParameters )
        }
        req.spliffyUrl.pathParameters = {}
        if( pathParameters && pathParameters.length > 0 ) {
            for( let i in pathParameters ) {
                req.spliffyUrl.pathParameters[pathParameters[i]] = decodePathParameters
                    ? decodeURIComponent( uwsReq.getParameter( i ) )
                    : uwsReq.getParameter( i )
            }
        }
        req.params = req.spliffyUrl.pathParameters
        req.headers = {}
        req.method = uwsReq.getMethod().toUpperCase()
        req.remoteAddress = addressArrayBufferToString( res.getRemoteAddressAsText() )
        req.proxiedRemoteAddress = addressArrayBufferToString( res.getProxiedRemoteAddressAsText() )
        uwsReq.forEach( ( header, value ) => setMultiValueKey( req.headers, normalizeHeader( header ), value ) )
        req.get = header => req.headers[normalizeHeader( header )]
        if( parseCookie && req.headers.cookie ) {
            req.cookies = cookie.parse( req.headers.cookie ) || {}
        }
        return req
    },
    decorateResponse( res, req, finalizeResponse, errorTransformer, endError ) {
        res.onAborted( () => {
            res.ended = true
            res.writableEnded = true
            res.finalized = true
            log.error( `Request to ${req.url} was aborted` )
        } )

        res.headers = {}
        res.headersSent = false
        res.setHeader = ( header, value ) => {
            res.headers[normalizeHeader( header )] = value
        }
        res.removeHeader = header => {
            delete res.headers[normalizeHeader( header )]
        }
        res.flushHeaders = () => {
            if( res.headersSent ) return
            if( !res.statusCode ) res.statusCode = 200
            if( !res.statusMessage ) res.statusMessage = 'OK'
            res.headersSent = true
            res.writeStatus( `${res.statusCode} ${res.statusMessage}` )
            if( typeof res.onFlushHeaders === 'function' ) {
                res.onFlushHeaders( res )
            }
            for( let header of Object.keys( res.headers ) ) {
                if( Array.isArray( res.headers[header] ) ) {
                    for( let multiple of res.headers[header] ) {
                        res.writeHeader( header, multiple.toString() )
                    }
                } else {
                    res.writeHeader( header, res.headers[header].toString() )
                }
            }
        }
        res.writeHead = ( status, headers ) => {
            this.statusCode = status
            res.assignHeaders( headers )
        }
        res.assignHeaders = headers => {
            for( let header of Object.keys( headers ) ) {
                res.headers[normalizeHeader( header )] = headers[header]
            }
        }
        res.getHeader = header => {
            return res.headers[normalizeHeader( header )]
        }
        res.status = ( code ) => {
            this.statusCode = code
            return this
        }

        function toArrayBuffer( buffer ) {
            return buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength );
        }

        let outStream
        res.getWritable = () => {
            if( !outStream ) {
                res.streaming = true
                outStream = new Writable( {
                    write: (chunk, encoding, cb) => {
                        try{
                            res.flushHeaders()
                            res.write( chunk )
                            cb()
                        } catch (e) {
                            cb(e)
                        }
                    }
                } )
                    .on( 'finish', res.end )
                    .on( 'end', res.end )
                    .on( 'error', e => {
                        try {
                            outStream.destroy()
                        } finally {
                            endError( res, e, uuid(), errorTransformer )
                        }
                    } )
            }
            return outStream
        }
        res.writeArrayBuffer = res.write
        res.write = chunk => {
            res.streaming = true
            res.flushHeaders()
            if( chunk instanceof Buffer ) {
                res.writeArrayBuffer( toArrayBuffer( chunk ) )
            } else if( typeof chunk === 'string' ) {
                res.writeArrayBuffer( toArrayBuffer( Buffer.from( chunk, 'utf8' ) ) )
            } else {
                res.writeArrayBuffer( toArrayBuffer( Buffer.from( JSON.stringify( chunk ), 'utf8' ) ) )
            }
        }

        const uwsEnd = res.end;
        res.ended = false
        res.end = body => {
            if( res.ended ) {
                return
            }
            res.ended = true
            //provide writableEnded like node does, with slightly different behavior
            if( !res.writableEnded ) {
                res.writableEnded = true
                res.flushHeaders()
                uwsEnd.call( res, body )
            }
            if( typeof res.onEnd === 'function' ) {
                res.onEnd()
            }
        }

        res.redirect = function( code, location ) {
            if( arguments.length === 1 ) {
                location = code
                code = 301
            }
            return finalizeResponse( req, res, {
                statusCode: code,
                headers: {
                    'location': location
                }
            } )
        }
        res.send = ( body ) => {
            finalizeResponse( req, res, body )
        }
        res.json = res.send
        res.setCookie = setCookie( res )
        res.cookie = res.setCookie
        return res

    }
}