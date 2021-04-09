module.exports = ( env ) =>
    ( {
        routeDir: __dirname + '/www',
        port: 420,
        staticContentTypes: {
            '.spliff': 'image/png'
        },
        // decodeQueryParameters: true,
        middleware: [(req, res, next)=>{
            console.log("Look at me! I'm in the middle!")
            next()
        }],
        resolveWithoutExtension: '.js',
        cacheStatic: true,
        greenlock: {
            packageRoot: __dirname,
            configDir: "./greenlock.d",
            maintainerEmail: "spliffy@example.com",
            cluster: false
        }
    } )
