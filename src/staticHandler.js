const fs = require( 'fs' )
const etag = require( 'etag' )

const readFile = async ( fullPath ) => await new Promise(
    ( resolve, reject ) =>
        fs.readFile( fullPath, ( err, data ) => {
                if( err ) reject( err )
                else resolve( data )
            }
        )
)

const writeHeaders = ( req, res, tag, stat, contentType, staticCacheControl ) => {
    if( req.headers['if-none-match'] === tag ) {
        res.statusCode = 304
        res.statusMessage = 'Not Modified'
        return
    }
    res.writeHead( 200, {
        'Content-Type': contentType,
        // content-length should not be included because transfer-encoding is chunked
        // see https://datatracker.ietf.org/doc/html/rfc2616#section-4.4 sub section 3.
        // Not all clients are compliant (node-fetch) and throw instead of ignoring the header as specified
        'Cache-Control': staticCacheControl || 'max-age=600',
        'ETag': tag
    } )
}

const readStat = async path => new Promise( ( resolve, reject ) =>
    fs.stat( path, ( err, stats ) =>
        err ? reject( err ) : resolve( stats )
    ) )

module.exports = {
    create: ( fullPath, contentType, cacheStatic, staticCacheControl ) => {
        const cache = {}
        return {
            GET: async ( { req, res } ) => {
                if( cacheStatic ) {
                    if( !cache.exists || !cache.stat ) {
                        cache.exists = fs.existsSync( fullPath )
                        if( cache.exists ) {
                            cache.stat = await readStat( fullPath )
                            cache.content = await readFile( fullPath )
                            cache.etag = etag( cache.content )
                        }
                    }
                    if( !cache.exists ) {
                        return {
                            statusCode: 404,
                            statusMessage: 'Not Found'
                        }
                    }
                    writeHeaders( req, res, cache.etag, cache.stat, contentType, staticCacheControl )
                    if( res.statusCode === 304 ) {
                        return
                    }
                    return cache.content
                } else {
                    if( !fs.existsSync( fullPath ) ) {
                        return {
                            statusCode: 404,
                            statusMessage: 'Not Found'
                        }
                    }
                    let stat = await readStat( fullPath )
                    writeHeaders( req, res, etag( stat ), stat, contentType, staticCacheControl )
                    if( res.statusCode === 304 ) {
                        return
                    }
                    if( stat.size === 0 ) {
                        return ""
                    }
                    return fs.createReadStream( fullPath )
                }
            }
        }
    }
}