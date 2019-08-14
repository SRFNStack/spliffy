const contentTypes = require( './content-types.js' )
const fs = require('fs')
const etag = require('etag')
const serverConfig = require('./serverConfig')
const log = require('./log')

module.exports = {
    create: ( fullPath, fileName, configContentTypes ) => {
        const extension = fileName.indexOf( '.' ) > -1 ? fileName.slice( fileName.lastIndexOf( '.' ) ).toLowerCase() : 'default'
        let contentType = configContentTypes && serverConfig.current.staticContentTypes[ extension ] || null

        contentType = contentType ? contentType : contentTypes[ extension ]
        const stat = fs.statSync( fullPath )
        let tag = etag( fs.readFileSync( fullPath ) )
        //TODO add file caching here
        fs.watch( fullPath, () => {
            try {
                tag = etag( fs.readFileSync( fullPath ) )
            } catch(e) {
                log.warning( 'failed to update etag for ' + fullPath, e )
            }
        } )
        return {
            GET: ( { req, res } ) => {
                if( !fs.existsSync( fullPath ) ) {
                    return {
                        statusCode: 404,
                        statusMessage: 'Not Found'
                    }
                } else if( req.headers[ 'if-none-match' ] === tag ) {
                    return {
                        statusCode: 304,
                        statusMessage: 'Not Modified'
                    }
                } else {
                    res.writeHead( 200, {
                        'content-type': contentType,
                        'content-length': stat.size,
                        'cache-control': serverConfig.current.staticCacheControl || 'max-age=600',
                        'ETag': tag
                    } )

                    const stream = fs.createReadStream( fullPath ).pipe( res )
                    return new Promise( ( resolve ) => {
                        stream.on( 'finish', resolve )
                    } )
                }
            }
        }
    }
}