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
    filters: [
        ( {url, req, reqBody, res, handler, routeInfo, handlerInfo} ) => {
            res.finished = true
        }
    ]
    acceptsDefault: "*/*",
    defaultContentType: "*/*",
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
        port: 14420,
        letsEncrypt: {
                        directory: "staging",
                        termsOfServiceAgreed: true,
                        email: "public@spliffy.com",
                        domains: ["www.spliffy.dev","spliffy.dev"],
                        certPath: __dirname + "/certs/letsEncrypt"
                    }
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
            ': A prefix that will be included at the beginning of the path for every request. For example, a request to /foo becomes /routePrefix/foo' )
    ),
    li( strong( 'filters' ),
        ': An array of functions to filter incoming requests. An object with the following ',
        'properties is passed to each filter before the request is handler.',
        ul(
            li( strong( 'url' ), ': See handler url argument' ),
            li( strong( 'req' ), ': The un-adulterated node IncomingMessage request object' ),
            li( strong( 'reqBody' ), ': The original unmodified request body' ),
            li( strong( 'res' ), ': The un-adulterated node ServerResponse response object' ),
            li( strong( 'handler' ), ': The request handler that will handle this request' ),
            li( strong( 'routeInfo' ), ': Meta information about the route' ),
            li( strong( 'handlerInfo' ), ': Meta information about the handler' )
        )
    ),
    li( strong( 'acceptsDefault' ),
        ': The default mime type to use when accepting a request body. e({m},/) will convert objects from json by default' ),
    li( strong( 'defaultContentType' ),
        ': The default mime type to use when writing content to a response. will convert objects to json by default ' ),
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
    li( strong( 'decodeQueryParameters' ),
        ': run decodeURIComponent(param.replace(/+/g,"%20")) on each query parameter key and value. This is disabled by default. The recommended way to send data is via json in a request body.' ),
    li( strong( 'watchFiles' ),
        ': watch the files on disk for changes. Otherwise changes require a restart. false by default ' ),
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
        li( strong( 'key' ), ': The path to the key file to use for https' ),
        li( strong( 'cert' ), ': The path to the certificate file to use for https' ),
        li( strong( 'port' ), ': The port to listen on for https' ),
        li( strong( 'letsEncrypt' ),
            ': Use let"s encrypt to automatically issue trusted certificates. If this is set, key and cert are ignored.',
            ul(
                li( strong( 'termsOfServiceAgreed' ), ': Whether you agree to the Subscriber Agreement: ',
                    a( { href: 'https://letsencrypt.org/repository/' }, 'https://letsencrypt.org/repository/' ) ),
                li( strong( 'directory' ),
                    ': The let"s encrypt directory to use. Must me one of ["staging","production"]' ),
                li( strong( 'domains' ),
                    ': The array of domains that you want to obtain a certificate for. Wildcard domains are not supported.' ),
                li( strong( 'certPath' ), ': The directory to read certs from and place certs we generate in.' ),
                li( strong( 'email' ), ': The optional email to use for registering an account.' )
            )
        )
    )
)