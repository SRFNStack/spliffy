import { a, div, li, p, strong, ul } from './fnelements.js'
import prismCode from './prismCode.js'

export default div(
    p( 'These are all of the settings available and their defaults. You can include just the properties you want to change or all of them.' ),
    prismCode( `{
    port: 10420,
    routeDir: './www',
    logLevel: 'INFO',
    logAccess: true,
    routePrefix: "api",
    notFoundRoute: "/404",
    acceptsDefault: "*/*",
    defaultContentType: "*/*",
    resolveWithoutExtension: ['.js'],
    errorTransformer: ( e, refId ) => e,
    contentHandlers: {
        'application/json': {
            read: requestBody => JSON.parse(requestBody),
            write: responseBody => JSON.stringify(responseBody)
        }
    },
    staticContentTypes: {
        '.foo': 'application/foo'
    },
    staticCacheControl: "max-age=86400",
    auth: {
        appAllow: { users: ['Space Cowboy'], roles:['/secrets/.*': ['joker', 'mid-night toker'] ] },
        matchAllow: [ {pattern: '/home', allow: { users: ['towelie'], roles: ['towel'] }} ],
        authRequired: ['.*'],
        noAuthRequired: ['/login', '/signup'],
        jwt: {
            issuer: "spliffy",
            audience: "www.spliffy.dev",
            signOpts: {},
            verifyOpts: {}
        }
    },
    secure: {
        key: "/opt/certs/server.key",
        cert: "/opt/certs/server.cert",
        port: 14420
    }
}
`, null, '100%'
    ),
    ul(
        li( strong( 'port' ), ': The port for the server to listen on' ),
        li( strong( 'routeDir' ), ': The directory the routes are contained in, should be an absolute path' ),
        li( strong( 'logLevel' ),
            ': The level at which to log. One of ["ERROR","WARN","INFO","DEBUG"].',
            ' Default "INFO". You can use const {log} = require("spliffy") in your handlers'
        ),
        li( strong( 'logAccess' ), ': Whether to log access to the server or not. Default true.' ),
        li( strong( 'routePrefix' ),
            ': A prefix that will be included at the beginning of the path for every request. For example, a request to /foo becomes /routePrefix/foo' ),
        li( strong( 'notFoundRoute' ),
            ': The route to use for the not found page. This can also be used as a catchall for single page apps.' ),
        li( strong( 'acceptsDefault' ),
            ': The default mime type to use when accepting a request body. e({m},/) will convert objects from json by default' ),
        li( strong( 'defaultContentType' ),
            ': The default mime type to use when writing content to a response. will convert objects to json by default ' ),
        li( strong( 'resolveWithoutExtension' ),
            ': Add extensions to this list to allow resolving files without their extension. For example, setting [\'.js\'] would cause /foo.js to also be routable as /foo' ),
        li( strong( 'errorTransformer' ),
            ': A function to transform errors to a more user friendly error. A refId is passed as the second argument to help correlate error messages.' ),
        li( strong( 'contentHandlers' ),
            ': Content negotiation handlers keyed by the media type they handle. Media types must be all lower case.',
            ul(
                li( strong( 'read' ), ': A method to convert the request body to an object' ),
                li( strong( 'write' ), ': A method to convert the response body to a string' )
            )
        ),
        li( strong( 'staticContentTypes' ),
            ': Custom file extension to content-type mappings. These overwrite default mappings from: ',
            a( { href: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Complete_list_of_MIME_types' },
               'List Of Mime Types' )
        ),
        li( strong( 'staticCacheControl' ), ': Custom value for the Cache-Control header of static files' ),
        li( strong( 'decodePathParameters' ),
            ': run decodeURIComponent(param.replace(/+/g,"%20")) on each path parameter value. true by default.' ),
        li( strong( 'staticMode' ),
            ': if true, the server will only serve static content and will not execute js request handlers. ' ),
        li( strong( 'decodeQueryParameters' ),
            ': run decodeURIComponent(param.replace(/+/g,"%20")) on each query parameter key and value. This is disabled by default. The recommended way to send data is via json in a request body.' ),
        li( strong( 'cacheStatic' ), ': cache static files in memory to increase performance. false by default.' ),
        li( strong( 'auth' ), ': Use authentication.',
            ul(
                li( strong( 'appAllow' ),
                    ': Permissions that apply to all routes except those matched by noAuthRequired' ),
                li( strong( 'matchAllow' ),
                    ': Permissions that apply to routes that match the specified patterns, except those matched by noAuthRequired' ),
                li( strong( 'authRequired' ),
                    ': An array of regex path patterns that determine which routes require authentication' ),
                li( strong( 'noAuthRequired' ),
                    ': An array of regex path patterns that determine which routes DO NOT require authentication. This overrides all other settings.' ),
                li( strong( 'jwt' ), ':',
                    ul(
                        li( strong( 'iss' ), ': The issuer to add as a claim to the jwt token' ),
                        li( strong( 'aud' ), ': The audience to add as a claim to the jwt token' ),
                        li( strong( 'signOpts' ), ': Opts to pass to ',
                            a( { href: 'https://www.npmjs.com/package/jsonwebtoken#jwtsignpayload-secretorprivatekey-options-callback' },
                               'jwt.sign()' )
                        ),
                        li( strong( 'verifyOpts' ), ': Opts to pass to ',
                            a( { href: 'https://www.npmjs.com/package/jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback' },
                               'jwt.verify()' )
                        )
                    )
                )
            )
        ),
        li( strong( 'secure' ), ': use https for all traffic. All traffic to the http port will be redirected to https' ),
        ul(
            li( strong( 'key' ), ': (Optional for manual config) The path to the key file to use for https' ),
            li( strong( 'cert' ), ': (Optional for manual config) The path to the certificate file to use for https' ),
            li( strong( 'port' ), ': The port to listen on for https' ),
            li( strong('greenlock'), ': The object to pass to greenlock-express.init, see ', a('https://www.npmjs.com/package/greenlock-express'))
        )
    )
)
