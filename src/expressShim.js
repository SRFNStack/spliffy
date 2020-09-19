const spliffy = require( './index.js' )
const cookie = require( 'cookie' )
const setCookie = ( res ) => function() {return res.setHeader( 'set-cookie', [ ...( res.getHeader( 'set-cookie' ) || [] ), cookie.serialize( ...arguments ) ] )}
/**
 * Provide a minimal set of shims to make most middleware, like passport, work
 * @type {{decorateResponse(*=, *=, *): *, decorateRequest(*): *}}
 */
module.exports = {
    setCookie,
    decorateRequest(req){
        req.cookies = req.headers.cookie && cookie.parse( req.headers.cookie ) || {}
        req.query = req.spliffyUrl.query
        return req
    },
    decorateResponse(res, req, finalizeResponse){
        res.status = (code)=>{
            this.statusCode = code
            return this
        }
        res.redirect = ( code, location ) => {
            if( typeof code === 'string' ) {
                code = 301
                location = code
            }
            finalizeResponse( req, res, spliffy.redirect( location, code === 301 )() )
        }
        res.send = (body)=>{
            finalizeResponse( req, res, body )
        }
        res.json = res.send
        res.setCookie = setCookie(res)
        return res

    }
}