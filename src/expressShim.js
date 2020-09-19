const spliffy = require( './index.js' )
/**
 * Provide a minimal set of shims to make most middleware, like passport, work
 * @type {{decorateResponse(*=, *=, *): *, decorateRequest(*): *}}
 */
module.exports = {
    decorateRequest(req){
        req.cookies = req.headers.cookie && cookie.parse( req.headers.cookie ) || {}
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
            finalizeResponse( req, res, spliffy.redirect( location, code === 301 ) )
        }
        res.send = (body)=>{
            finalizeResponse( req, res, body )
        }
        res.json = res.send
        return res

    }
}