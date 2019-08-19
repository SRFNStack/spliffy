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
        secure: {
            port: 443,
            letsEncrypt: {
                directory: "production",
                termsOfServiceAgreed: true,
                email: "public@spliffy.com",
                domains: ["www.spliffy.dev"],
                certPath: __dirname + "/certs/letsEncrypt"
            }
        }
    }
)