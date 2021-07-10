const fs = require( 'fs' )
const etag = require( 'etag' )
const serverConfig = require( './serverConfig' )

const readFile = async ( fullPath ) => await new Promise(
    ( resolve, reject ) =>
        fs.readFile( fullPath, ( err, data ) => {
                if( err ) reject( err )
                else resolve( data )
            }
        )
)

const writeHeaders = ( req, res, tag, stat, contentType ) => {
    if( req.headers['if-none-match'] === tag ) {
        res.statusCode = 304
        res.statusMessage = 'Not Modified'
        return
    }
    res.writeHead( 200, {
        'Content-Type': contentType,
        'Content-Length': stat.size,
        'Cache-Control': serverConfig.current.staticCacheControl || 'max-age=600',
        'ETag': tag
    } )
}

const readStat = async path => new Promise( ( resolve, reject ) =>
    fs.stat( path, ( err, stats ) =>
        err ? reject( err ) : resolve( stats )
    ) )

module.exports = {
    create: ( fullPath, contentType ) => {
        const cache = {}
        return {
            GET: async ( { req, res } ) => {
                if( serverConfig.current.cacheStatic ) {
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
                    writeHeaders( req, res, cache.etag, cache.stat, contentType )
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
                    writeHeaders( req, res, etag( stat ), stat, contentType )
                    if( res.statusCode === 304 ) {
                        return
                    }
                    res.flushHeaders()
                    if( stat.size === 0 ) {
                        return ""
                    }
                    return fs.createReadStream( fullPath )
                }
            }
        }
    }
}