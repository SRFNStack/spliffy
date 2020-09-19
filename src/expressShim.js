const cookie = require( 'cookie' )
const setCookie = ( res ) => function() {return res.setHeader( 'set-cookie', [ ...( res.getHeader( 'set-cookie' ) || [] ), cookie.serialize( ...arguments ) ] )}
/**
 * Provide a minimal set of shims to make most middleware, like passport, work
 * @type {{decorateResponse(*=, *=, *): *, decorateRequest(*): *}}
 */
module.exports = {
    setCookie,
    decorateRequest( req ) {
        req.cookies = req.headers.cookie && cookie.parse( req.headers.cookie ) || {}
        req.query = req.spliffyUrl.query
        return req
    },
    decorateResponse( res, req, finalizeResponse ) {
        res.status = ( code ) => {
            this.statusCode = code
            return this
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
        return res

    }
}