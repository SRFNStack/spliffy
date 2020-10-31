const contentTypes = require( './content-types.js' )
const fs = require( 'fs' )
const etag = require( 'etag' )
const serverConfig = require( './serverConfig' )
const PassThrough = require( 'stream' ).PassThrough

module.exports = {
    create: async( fullPath, fileName, configContentTypes ) => {
        const extension = fileName.indexOf( '.' ) > -1 ? fileName.slice( fileName.lastIndexOf( '.' ) ).toLowerCase() : 'default'
        let contentType = configContentTypes && serverConfig.current.staticContentTypes[ extension ] || null

        contentType = contentType ? contentType : contentTypes[ extension ]

        const cache = {}

        const readFile = async( fullPath ) => ( {
            stat: fs.statSync( fullPath ),
            content: await new Promise(
                ( resolve, reject ) =>
                    fs.readFile( fullPath, ( err, data ) => {
                                     if( err ) reject( err )
                                     else resolve( data )
                                 }
                    )
            )
        } )

        const writeResponse = ( req, res, tag, stat, content ) => {
            if( req.headers[ 'if-none-match' ] === tag ) {
                return {
                    statusCode: 304,
                    statusMessage: 'Not Modified'
                }
            }
            res.writeHead( 200, {
                'content-type': contentType,
                'content-length': stat.size,
                'cache-control': serverConfig.current.staticCacheControl || 'max-age=600',
                'ETag': tag
            } )
            let stream
            if( content ) stream = new PassThrough().end( content ).pipe( res )
            else stream = fs.createReadStream( fullPath ).pipe( res )

            return new Promise( ( resolve ) => {
                stream.on( 'finish', resolve )
            } )
        }


        return {
            GET: async( { req, res } ) => {
                if( !fs.existsSync( fullPath ) ) {
                    return {
                        statusCode: 404,
                        statusMessage: 'Not Found'
                    }
                } else {
                    if( serverConfig.current.cacheStatic ) {
                        if(!cache.content) {
                            Object.assign(cache, await readFile(fullPath))
                            cache.etag = etag( cache.content )
                        }
                        await writeResponse( req, res, etag( cache.content ), cache.stat, cache.content )
                    } else {
                        let file = await readFile( fullPath )
                        await writeResponse( req, res, etag( file.content ), file.stat, file.content )
                    }

                }
            }
        }
    }
}