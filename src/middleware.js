const log = require( './log' )
/**
 * middleware is stored as an object where the properties are request methods the middleware applies to
 * if a middleware applies to all methods, the property ALL is used
 * example:
 * {
 *     GET: [(req,res,next)=>console.log('ice cream man')]
 *     POST: [(req,res,next)=>console.log('gelato')]
 *     ALL: [(req,res,next)=>console.log('bruce banner')]
 * }
 */
const mergeMiddleware = ( incoming, existing ) => {
    const mergeInto = cloneMiddleware( existing )

    validateMiddleware( incoming )
    if( Array.isArray( incoming ) ) {
        mergeInto.ALL = ( existing.ALL || [] ).concat( incoming )
    } else if( typeof incoming === 'object' ) {
        for( let method in incoming ) {
            let upMethod = method.toUpperCase()
            mergeInto[upMethod] = ( mergeInto[method] || [] ).concat( incoming[upMethod] || [] )
        }
    }
    return mergeInto
}

const cloneMiddleware = ( middleware ) => {
    const clone = { ...middleware }
    for( let method in middleware ) {
        clone[method] = [...( middleware[method] || [] )]
    }
    return clone
}

/**
 * Ensure the given middleware is valid
 * @param middleware
 */
const validateMiddleware = ( middleware ) => {
    if( Array.isArray( middleware ) ) {
        validateMiddlewareArray( middleware )
    } else if( typeof middleware === 'object' ) {
        for( let method in middleware ) {
            //ensure methods are always available as uppercase
            let upMethod = method.toUpperCase()
            middleware[upMethod] = middleware[method]
            validateMiddlewareArray( middleware[upMethod] )
        }
    } else {
        throw new Error( 'Invalid middleware definition: ' + middleware )
    }
}

const validateMiddlewareArray = ( arr ) => {
    if( !Array.isArray( arr ) ) {
        throw 'middleware must be an array of functions'
    }
    for(let f of arr){
        if( typeof f !== 'function' ) {
            throw 'Each element in the array of middleware must be a function'
        }
    }
}

async function executeMiddleware( middleware, errorMiddleware, req, res, reqErr ) {
    let err
    await new Promise( ( resolve, reject ) => {
        let current = -1
        let isError = false
        const next = ( mwErr ) => {
            if( !isError && mwErr ) {
                isError = true
                current = -1
            }
            if( res.writableEnded ) {
                resolve()
                return
            }
            current++
            if( ( isError && current === errorMiddleware.length ) ||
                ( !isError && current === middleware.length )
            ) {
                if( mwErr )
                    reject( mwErr )
                resolve()
            } else {
                try {
                    let mw = isError ? errorMiddleware[current] : middleware[current]
                    if( mwErr ) {
                        mw( mwErr, req, res, next )
                    } else {
                        mw( req, res, next )
                    }
                } catch( e ) {

                    log.error( 'Middleware threw exception', e )
                    next( e )
                }
            }
        }

        next( reqErr )
    } ).catch( e => {
        err = e
        return null
    } )
    if(err) throw err
}

module.exports = {
    validateMiddlewareArray,
    cloneMiddleware,
    validateMiddleware,
    mergeMiddleware,
    executeMiddleware
}