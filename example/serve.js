require( '../src/index' )(
    {
        routeDir: __dirname + '/www',
        staticContentTypes: {
            '.spliff': 'image/png'
        },
        watchFiles: true,
        decodeQueryParameters: true,
        cacheStatic: true
    }
)