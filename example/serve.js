require( '../src/index' )(
    {
        routeDir: __dirname + '/www',
        port: 80,
        staticContentTypes: {
            '.spliff': 'image/png'
        },
        watchFiles: true,
        // decodeQueryParameters: true,
        cacheStatic: true,
        ssl: {
            port: 443,
            letsEncrypt: {
                directory: "staging",
                termsOfServiceAgreed: true,
                email: "r@snow87.com",
                domains: ["spliffy.snow87.com"],
                certPath: __dirname + "/certs/letsEncrypt"
            }
        }
    }
)