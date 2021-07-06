const cookie = require( 'cookie' )
const serverConfig = require( './serverConfig' )
const http = require('http')
const parseUrl = require( './parseUrl' )
const setCookie = ( res ) => function() {
    return res.setHeader( 'set-cookie', [...( res.getHeader( 'set-cookie' ) || [] ), cookie.serialize( ...arguments )] )
}
const log = require( './log' )
const addressArrayBufferToString = addrBuf => String.fromCharCode.apply( null, new Int8Array( addrBuf ) )
const excludedMessageProps = {
    setTimeout: true, _read: true, destroy: true, _addHeaderLines: true, _addHeaderLine: true, _dump: true, __proto__: true
}

/**
 * Provide a minimal set of shims to make most middleware, like passport, work
 * @type {{decorateResponse(*=, *=, *): *, decorateRequest(*): *}}
 */
module.exports = {
    setCookie,
    decorateRequest( req, res ) {
        let query = req.getQuery()
        req.url = `${req.getUrl()}${query ? '?' + query : ''}`
        req.spliffyUrl = parseUrl( req.getUrl(), req.getQuery() )
        req.headers = {}
        req.method = req.getMethod().toUpperCase()
        req.remoteAddress = addressArrayBufferToString( res.getRemoteAddressAsText() )
        req.proxiedRemoteAddress = addressArrayBufferToString( res.getProxiedRemoteAddressAsText() ) || undefined
        req.forEach( ( header, value ) => req.headers[header] = value )
        if( serverConfig.current.parseCookie ) {
            req.cookies = req.headers.cookie && cookie.parse( req.headers.cookie ) || {}
        }
        //frameworks like passport like to modify the message prototype...
        for(let p of Object.keys(http.IncomingMessage.prototype)){
            if(!req[p] && !excludedMessageProps[p]) req[p] = http.IncomingMessage.prototype[p]
        }
        return req
    },
    decorateResponse( res, req, finalizeResponse ) {
        res.onAborted( () => {
            log.error( `Request to ${req.url} was aborted prematurely` )
        } )
        const writeHead = {}

        res.headers = {}
        res.headersSent = false
        res.setHeader = ( header, value ) => {
            res.headers[header.toLowerCase()] = value
        }
        res.removeHeader = header => delete res.headers[header.toLowerCase()]
        res.flushHeaders = () => {
            res.headersSent = true
            // https://nodejs.org/api/http.html#http_response_writehead_statuscode_statusmessage_headers
            //When headers have been set with response.setHeader(), they will be merged with any headers passed to response.writeHead(), with the headers passed to response.writeHead() given precedence.
            Object.assign( res.headers, writeHead )
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
                writeHead[header.toLowerCase()] = headers[header]
            }
        }
        res.getHeader = header => {
            let lc = header.toLowerCase()
            return writeHead[lc] || res.headers[lc]
        }
        res.status = ( code ) => {
            this.statusCode = code
            return this
        }

        const ogEnd = res.end
        res.ended = false
        res.end = body => {
            if( res.ended ) return
            res.ended = true
            if(!res.writableEnded){
                res.writableEnded = true
                res.writeStatus( `${res.statusCode} ${res.statusMessage}` )
                res.flushHeaders()
                ogEnd.call( res, body )
            }
            if(typeof res.onEnd === 'function'){
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