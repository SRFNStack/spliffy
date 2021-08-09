const cookie = require( 'cookie' )
const serverConfig = require( './serverConfig' )
const http = require( 'http' )
const { parse, setMultiValueKey } = require( './url' )
const setCookie = ( res ) => function() {
    return res.setHeader( 'Set-Cookie', [...( res.getHeader( 'Set-Cookie' ) || [] ), cookie.serialize( ...arguments )] )
}
const log = require( './log' )
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

/**
 * Provide a minimal set of shims to make most middleware, like passport, work
 * @type {{decorateResponse(*=, *=, *): *, decorateRequest(*): *}}
 */
module.exports = {
    setCookie,
    decorateRequest( uwsReq, pathParameters, res ) {
        //uwsReq can't be used in async functions because it gets de-allocated when the handler function returns
        let req = {}
        let query = uwsReq.getQuery()
        req.path = uwsReq.getUrl()
        req.url = `${req.path}${query ? '?' + query : ''}`
        req.spliffyUrl = parse( uwsReq.getUrl(), uwsReq.getQuery() )
        req.spliffyUrl.pathParameters = {}
        if( pathParameters && pathParameters.length > 0 ) {
            for( let i in pathParameters ) {
                req.spliffyUrl.pathParameters[pathParameters[i]] = serverConfig.current.decodePathParameters
                    ? decodeURIComponent( uwsReq.getParameter( i ) )
                    : uwsReq.getParameter( i )
            }
        }
        req.params = req.spliffyUrl.pathParameters
        req.headers = {}
        req.method = uwsReq.getMethod().toUpperCase()
        req.remoteAddress = addressArrayBufferToString( res.getRemoteAddressAsText() )
        req.proxiedRemoteAddress = addressArrayBufferToString( res.getProxiedRemoteAddressAsText() ) || undefined
        uwsReq.forEach( ( header, value ) => setMultiValueKey( req.headers, normalizeHeader(header), value ) )
        req.get = header => req.headers[normalizeHeader(header)]
        if( serverConfig.current.parseCookie && req.headers.cookie ) {
            req.cookies = cookie.parse( req.headers.cookie ) || {}
        }
        //frameworks like passport like to modify the message prototype...
        for( let p of Object.keys( http.IncomingMessage.prototype ) ) {
            if( !req[p] && !excludedMessageProps[p] ) req[p] = http.IncomingMessage.prototype[p]
        }
        return req
    },
    decorateResponse( res, req, finalizeResponse ) {
        res.onAborted( () => {
            res.ended = true
            res.writableEnded = true
            res.finalized = true
            log.error( `Request to ${req.url} was aborted prematurely` )
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
            res.headersSent = true
            if(typeof res.onFlushHeaders === 'function') {
                res.onFlushHeaders(res)
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
                res.headers[normalizeHeader(header)] = headers[header]
            }
        }
        res.getHeader = header => {
            return res.headers[normalizeHeader( header )]
        }
        res.status = ( code ) => {
            this.statusCode = code
            return this
        }
        //use at your own risk
        res.uwsEnd = res.end;
        res.ended = false
        res.end = body => {
            if( res.ended ) {
                return
            }
            res.ended = true
            //provide writableEnded like node does
            if( !res.writableEnded ) {
                res.writableEnded = true
                res.writeStatus( `${res.statusCode} ${res.statusMessage}` )
                res.flushHeaders()
                res.uwsEnd( body )
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