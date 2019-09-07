const variantFilter = require('./variantFilter')

module.exports = ( env ) =>
    ( {
        routeDir: __dirname + '/www',
        port: 80,
        staticContentTypes: {
            '.spliff': 'image/png'
        },
        watchFiles: env !== 'prod',
        // decodeQueryParameters: true,
        cacheStatic: true,
        filters: [ () => ( { shenanigans: true } ), variantFilter ],
        secure: {
            port: 443,
            letsEncrypt: {
                directory: env === 'prod' ? 'production' : 'staging',
                termsOfServiceAgreed: true,
                email: 'public@spliffy.com',
                domains: [ 'www.spliffy.dev', 'spliffy.dev' ],
                certPath: __dirname + '/certs/letsEncrypt'
            }
        }
    } )
