import { a, div, li, p, strong, ul, code } from './fnelements.mjs'
import prismCode from './prismCode.js'

export default div(
  p('These are all of the settings available with example values. You can include just the properties you want to change or all of them.'),
  prismCode(`{
    port: 10420,
    httpsPort: 14420,
    httpsKeyFile: "/opt/certs/server.key",
    httpsCertFile: "/opt/certs/server.cert",
    routeDir: path.join(path.dirname(url.fileURLToPath(import.meta.url)), 'www'),
    logLevel: 'INFO',
    logAccess: true,
    logger: bunyan.createLogger({name: 'spliffy'}),
    routePrefix: "api",
    defaultRoute: "/app.js",
    notFoundRoute: "/404",
    acceptsDefault: "*/*",
    defaultContentType: "*/*",
    parseCookie: true,
    ignoreFilesMatching: ['iHateThisFile.sux'],
    allowTestFileRoutes: true,
    resolveWithoutExtension: ['.js'],
    errorTransformer: ( e, refId ) => e,
    contentHandlers: {
        'application/json': {
            deserialize: requestBody => JSON.parse(requestBody),
            serialize: responseBody => JSON.stringify(responseBody)
        }
    },
    staticContentTypes: {
        '.foo': 'application/foo'
    },
    staticCacheControl: "max-age=86400",
    extendIncomingMessage: false,
    writeDateHeader: false,
    autoOptions: false,
    nodeModuleRoutes: {
        nodeModulesPath: path.resolve(__dirname, '../node_modules'),
        files: [
            'cookie/index.js',
            {
                modulePath: 'etag/index.js',
                urlPath: '/etag.js'
            }
        ]
    }
}
`, null, '100%'
  ),
  ul(
    li(strong('port'), ': The port for the http server to listen on'),
    li(strong('httpsPort'), ': The port to listen on for https'),
    li(strong('httpsKeyFile'), ': (Optional for manual config) The path to the key file to use for https'),
    li(strong('httpsCertFile'), ': (Optional for manual config) The path to the certificate file to use for https'),
    li(strong('routeDir'), ': The directory the routes are contained in, should be an absolute path'),
    li(strong('logLevel'),
      ': The level at which to log. One of ["ERROR","WARN","INFO","DEBUG"].',
      ' Default "INFO". You can use import { log } from "@srfnstack/spliffy" in your handlers'
    ),
    li(strong('logAccess'), ': Whether to log access to the server or not. Default false.'),
    li(strong('logger'), ': A custom logger impl, logLevel and logAccess are ignored if this is provided.'),
    li(strong('routePrefix'),
      ': A prefix that will be included at the beginning of the path for every request. For example, a request to /foo becomes /routePrefix/foo'),
    li(strong('defaultRoute'),
      ': The default route to return when the path is not found. Responds with a 200 status. Takes precedence over notFoundRoute. Used for single page apps.'),
    li(strong('notFoundRoute'),
      ': The route to use for the not found page. Not used if defaultRoute is set. Responds with a 404 status code.'),
    li(strong('acceptsDefault'),
      ': The default mime type to use when accepting a request body. e({m},/) will convert objects from json by default'),
    li(strong('defaultContentType'),
      ': The default mime type to use when writing content to a response. will convert objects to json by default '),
    li(strong('parseCookie'),
      ': Whether to parse cookies on the request, false by default'),
    li(strong('ignoreFilesMatching'),
      ': A list of file name patterns to ignore when searching for routes. Files ending in .test.js are always ignored unless allowTestRoutes is set to true.'),
    li(strong('allowTestFileRoutes'),
      ': Allow files ending with .test.js to be considered as routes.'),
    li(strong('resolveWithoutExtension'),
      ': Add extensions to this list to allow resolving files without their extension. For example, setting [\'.js\'] would cause /foo.js to also be routable as /foo'),
    li(strong('errorTransformer'),
      ': A function to transform errors to a more user friendly error. A refId is passed as the second argument to help correlate error messages.'),
    li(strong('contentHandlers'),
      ': Content negotiation handlers keyed by the media type they handle. Media types must be all lower case.',
      ul(
        li(strong('deserialize'), ': A method to convert the request body to an object'),
        li(strong('serialize'), ': A method to convert the response body to a string')
      )
    ),
    li(strong('staticContentTypes'),
      ': Custom file extension to content-type mappings. These overwrite default mappings from: ',
      a({ href: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Complete_list_of_MIME_types' },
        'List Of Mime Types')
    ),
    li(strong('staticCacheControl'), ': Custom value for the Cache-Control header of static files'),
    li(strong('decodePathParameters'),
      ': run decodeURIComponent(param.replace(/+/g,"%20")) on each path parameter value. false by default.'),
    li(strong('staticMode'),
      ': if true, the server will only serve static content and will not execute js request handlers. '),
    li(strong('decodeQueryParameters'),
      ': run decodeURIComponent(param.replace(/+/g,"%20")) on each query parameter key and value. This is disabled by default. The recommended way to send data is via json in a request body.'),
    li(strong('cacheStatic'), ': cache static files in memory to increase performance. false by default.'),
    li(strong('extendIncomingMessage'), ': Apply the prototype of IncomingMessage to enable middleware that pollutes the prototype (like passportjs), default false.'),
    li(strong('writeDateHeader'), ': write a Date header with the server time with ISO format, default false.'),
    li(strong('autoOptions'), ': automatically generate options routes for every end point if not provided, default false.'),
    li(strong('nodeModuleRoutes'), ': Map files from node_modules directly to routes.',
      ul(
        li(strong('nodeModulesPath'), ': The absolute path to the node_modules directory'),
        li(strong('files'), ': An array of files to expose. Can be a string (relative path within node_modules) or an object with ', code('modulePath'), ' and ', code('urlPath'), ' properties.')
      )
    )
  )
)
