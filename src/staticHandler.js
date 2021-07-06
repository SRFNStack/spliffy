const fs = require( 'fs' )
const etag = require( 'etag' )
const serverConfig = require( './serverConfig' )
const log = require( "./log" );

function toArrayBuffer( buffer ) {
    return buffer.buffer.slice( buffer.byteOffset, buffer.byteOffset + buffer.byteLength );
}

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
        res.writeHead( 304, 'Not Modified' )
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

function onAbortedOrFinishedResponse( res, readStream ) {
    if( res.id === -1 ) {
        log.error( "ERROR! onAbortedOrFinishedResponse called twice for the same res!" )
    } else {
        readStream.destroy();
    }
    res.id = -1;
}

//borrowed from https://github.com/uNetworking/uWebSockets.js/blob/8ba1edc0bbd05f97f6b1c8a03fd93be89bec458d/examples/VideoStreamer.js#L38
async function streamFile( res, fullPath, stat ) {
    const totalSize = stat.size;
    return new Promise( ( resolve, reject ) => {
        const readStream = fs.createReadStream( fullPath )
        readStream.on( 'data', chunk => {
            const ab = toArrayBuffer( chunk );
            let lastOffset = res.getWriteOffset();
            let [ok, done] = res.tryEnd( ab, totalSize );
            if( done ) {
                onAbortedOrFinishedResponse( res, readStream );
                res.writableEnded = true
                resolve();
            } else if( !ok ) {
                readStream.pause();
                res.ab = ab;
                res.abOffset = lastOffset;
                res.onWritable( ( offset ) => {
                    let [ok, done] = res.tryEnd( res.ab.slice( offset - res.abOffset ), totalSize );
                    if( done ) {
                        onAbortedOrFinishedResponse( res, readStream );
                        res.writableEnded = true
                        resolve()
                    } else if( ok ) {
                        readStream.resume();
                    }
                    return ok;
                } );
            }
        } )
            .on( 'error', () =>
                reject( 'Unhandled read error from Node.js, you need to handle this!' )
            )
    } )
}

module.exports = {
    create: async ( fullPath, contentType ) => {
        const cache = {}

        return {
            GET: async ( { req, res } ) => {
                if( !fs.existsSync( fullPath ) ) {
                    return {
                        statusCode: 404,
                        statusMessage: 'Not Found'
                    }
                } else {
                    if( serverConfig.current.cacheStatic ) {
                        if( !cache.stat ) {
                            cache.stat = await readStat( fullPath )
                            cache.content = await readFile( fullPath )
                            cache.etag = etag( cache.content )
                        }
                        writeHeaders( req, res, cache.etag, cache.stat, contentType )
                        return cache.content
                    } else {
                        let stat = await readStat( fullPath )
                        writeHeaders( req, res, etag( stat ), stat, contentType )
                        res.flushHeaders()
                        if(stat.size === 0) {
                            return ""
                        }
                        await streamFile( res, fullPath, stat )
                    }
                }
            }
        }
    }
}