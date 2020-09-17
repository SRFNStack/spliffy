module.exports = ( env ) =>
    ( {
        routeDir: __dirname + '/www',
        port: 82,
        staticContentTypes: {
            '.spliff': 'image/png'
        },
        // decodeQueryParameters: true,
        middleware: [(req, res, next)=>{
            console.log("Look at me! I'm in the middle!")
            next()
        }],
        cacheStatic: true,
        // secure: {
        //     port: 4445,
        //     letsEncrypt: {
        //         directory: env === 'prod' ? 'production' : 'staging',
        //         termsOfServiceAgreed: true,
        //         email: 'public@spliffy.com',
        //         domains: [ 'www.spliffy.dev', 'spliffy.dev' ],
        //         certPath: __dirname + '/certs/letsEncrypt'
        //     }
        // }
    } )
