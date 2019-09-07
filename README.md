# ![Alt text](spliffy_logo_text_small.png?raw=true "Spliffy Logo")

> directory based routing with js request handlers and static file serving

## Getting started
Create a directories for your app

`mkdir -p ~/app/www`

Install spliffy

`cd ~/app && npm install spliffy`

Create a handler for the desired route name 

`vi ~/app/www/spliffy.js`
```js
module.exports = {
    GET: () => ({hello: "spliffy"})
}

```
Create the start script, ```vi ~/app/serve.js``` 
```js
require('spliffy')({routeDir: __dirname+ '/www'})
```

because the routeDir is ~/app/www, the filename `spliffy.js` creates the path `/spliffy`

The object passed to spliffy is the config. See the [Config](#Config) section for more information.

routeDir is the only required property and should be an absolute path.

`10420` is the default port for http, and can be changed by setting the port in the config

start the server
`node ~/app/serve.js`

Go to `localhost:10420/spliffy`

#### [Examples](https://github.com/narcolepticsnowman/spliffy/tree/master/example)

## HTTPS
HTTPS can be enabled by setting the secure.key and secure.cert properties on the [config](#Config). The default https port is 14420.

### Let's Encrypt automated public CA trusted certs
Let's encrypt is a free service that provides public trusted certificates to serve secure content to your users with.

This service is provided by the [Internet Security Research Group](https://www.abetterinternet.org/), learn more [Here](https://letsencrypt.org/about/).

To use this, you **MUST** be able to access your server from the internet at all of the specified domains on port 80 and 443. Other ports are not supported. 

Once you can do that, set config.secure.letsEncrypt to an object with at least the following properties

```js
{
    termsOfServiceAgreed: true,
    directory: 'staging',    
    domains: ["hightimes.com","www.hightimes.com"],
    certPath: __dirname +"/certs"
}
 ``` 

#### termsOfServiceAgreed: true
You must agree to the Subscriber Agreement found here: https://letsencrypt.org/repository/

#### directory: 'staging'
The let's encrypt directory to use. Must me one of ['staging','production']. 

Staging should be used to issue certificates for any pre-production purpose and has higher rate limits than production.

#### domains: ["hightimes.com","www.hightimes.com"]
The list of domains that you want to obtain a certificate for
*Wildcard domains are not supported because they can only be verified with a dns challenge and that requires access to the domain's dns configuration.*

#### certPath: '/opt/letsEncrypt/certs'
The directory to read certs from and place certs we generate in. 

*Ensure the cert directory is not contained in the routeDir! It would be really bad if someone downloaded your private key!*

These must be stored on disk so they can be re-used. This is essential to avoid abusing the api and triggering rate limits.

It's preferred that multiple servers share the same copy of the files, locks are used to prevent clobbering when renewals happen.

Renewal times are distributed throughout the range of minutes between two weeks before the expiration date and the expiration date to avoid multiple servers
from trying to renew the same domains at the same time and breaking rate limits

This also helps lower the chance of clobbering when renewing certificates.

Watches are placed on the files so if any server renews the cert, it will be detected by all servers and the server will be
re-initialized with the new cert.

You can see the rate limits here: https://letsencrypt.org/docs/rate-limits/ 

##### Overview of how it works
If we don't have a certificate already, or the certificate we have is up for renewal, we will place a new order for a certificate automatically.

- An account is created ore retrieved using either the specified account key, or a generated one.
- If a certificate key is provided it will be used to create the cert, one is generated if not provided. 
- An order for a new certificate for the specified domains is placed to let's encrypt.
- Let's encrypt responds with a challenge containing a token and an authorization value. 
- The authorization is served at the url /.well-known/acme-challenge/$token for the duration of the challenge.
- The server responds to Let's encrypt saying the challenge is ready, then polls until let's encrypt says the challenge is valid
- Let's encrypt makes several GET /.well-known/acme-challenge/$token requests to domains specified
- Our polling process detects that the challenge was passed and the cert is ready
- The certs are downloaded and https is started/restarted on all servers watching the files

Much better and far more detailed information can be found here:  https://letsencrypt.org/how-it-works/

### Static Files
Any non-js files will be served verbatim from disk.

You can watch files by setting watchFiles to true on the config. See the Caveats of doing that [here](https://nodejs.org/docs/latest/api/fs.html#fs_caveats)

Otherwise, If you add or rename files, you must restart the server for the changes to take effect.

Any file prefixed with 'index.' (i.e. index.html, index.txt, index.png) will be served as the default file in the directory they are in.

The extension determines the content-type of the file for the known types listed at [mozilla.org](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Complete_list_of_MIME_types)

You can also add custom extension to content-type mappings by setting the staticContentTypes property on the config.

GET is the only supported request method for static files, all other request methods will result in a 405 Method Not Allowed.

ETags will be generated on startup and will be recalculated if the file content changes. The cache-control max-age is set to 10min by default for static files.

You can configure this with the staticCacheControl property of the [config](#Config).

If you want to serve a .js file as a static file instead of having it be a route handler, change the extension to .static.js.

You can cache files in memory by setting cacheStatic to true on the config. If watchFiles is enabled these will be updated when the files change, if not the server will need a restart.

### JS Request Handler
```js
module.exports = {
    GET: ({url, body, headers, req, res}) => {        
        body: "hello Mr. Marley"
    }
}
```
The exported properties are all caps request methods, any request method is allowed.

Files named index.js can be created to handle the route of the name of the folder just like in apache.

Handler arguments:
- **url**: An object containing path and parameter information about the url
    - **path**: The path of the current request
    - **query**: An object containing the query parameters. Not decoded by default. This can be configured by setting the decodePathParameters to true.
    - **pathParameters**: parameters that are part of the path. Not decoded by default. This can be configured by setting the decodeQueryParameters to true.
- **body**: The body of the request
- **headers**: The request headers
- **req**: The un-adulterated node http.IncomingMessage
- **res**: The un-adulterated node http.ServerResponse

#### Handler Return
The handler can return any kind of data and it will be serialized automatically if there is a known serializer for the specified content-type.
The default, application/json, is already set.

If the returned value is Falsey, we will assume everything is fine and return a 200 OK.

You can return a promise that resolves to the response value, and the server will respond with the resolved value.

If you need to set the statusCode, headers, etc, you must return an object with a body property for the body and optionally one or more of the following properties
```js
{
    headers: {
        "cache-control": 'no-cache'
    },
    body: {
        some: 'object'
    },
    statusCode: 420,
    statusMessage: "Enhance Your Calm"
}
```

#### Route and Handler Metadata
You may pass additional information to filters or request handlers on each request at the route level and at each method level.

To pass route data you must set the `handlers` property on your default export, then all other properties are passed to filters and handlers as the `routeInfo` property.

To pass method specific data set the method to an object with a `handler` property, then all other properties will be passed as the `methodInfo` property.
```js
module.exports = {
    words: "Actin' funny, but I don't know why\n",
    handlers: {
        GET: {
            words: async ()=>"'Scuse me while I kiss the sky",
            handler: async ({url, body, headers, req, res, routeMeta, handlerMeta}) => ({        
                body: {
                    song: {
                        title: 'Purple Haze', 
                        artist: 'Jimi Hendrix', 
                        words: routeMeta.words + (await handlerMeta.words()) 
                    }
                }
            })
        }
    }
}
```

## Security
Use security to log in users. JWT is used by default to provide authentication and stateless session handling.
 
Authorization can be applied at multiple levels and a default JWT implementation is provided.

Roles can be applied at the following levels
   - Application wide
   - Specific path prefixes

Roles from all levels are passed to the handler. 

```js
module.exports = {
    secure: {users: ['space cowboy', 'gangster of love' ], roles: ['joker', 'smoker', 'mid-night toker']},
    handlers: {
        GET: {
            secure: {users: ['Steve Miller'], roles: ['maurice']},
            handler: ({url, body, headers, req, res}) => {        
                body: "hello Mr. Marley"
            }
        }
    }
}
```


##### Application wide
Enable security for every route. This takes precedence over 
`config.auth.all = true` 

Set roles using 

`config.auth.appRoles = ['space cowboy']`


##### A Whitelist of prefixes.
_If set, this takes precedence over prefixes_

**this is the preferred method of selecting paths**

Specific Route: `config.auth.whitelist = ['/login','/home','/']`

##### A list of prefixes
_provided as a convenience method for when it's needed_
`config.auth.prefixes = ['/secrets','/treasure','/candy']`

## Config
These are all of the settings available and their defaults. You can include just the properties you want to change or all of them.
```js
{
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
    https: {
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
```

- **port**: The port for the server to listen on
- **routeDir**: The directory the routes are contained in, should be an absolute path
- **logLevel**: The level at which to log. One of ['ERROR','WARN','INFO','DEBUG']. Default 'INFO'. You can use const {log} = require('spliffy') in your handlers
- **logAccess**: Whether to log access to the server or not. Default true.
- **routePrefix**: A prefix that will be included at the beginning of the path for every request. 
            For example, a request to /foo becomes /routePrefix/foo
- **filters**: An array of functions to filter incoming requests. An object with the following properties is passed to each filter before the request is handler.
    - **url**: See handler url argument
    - **req**: The un-adulterated node IncomingMessage request object
    - **reqBody**: The original unmodified request body
    - **res**: The un-adulterated node ServerResponse response object
    - **handler**: The request handler that will handle this request
    - **routeInfo**: Meta information about the route
    - **handlerInfo**: Meta information about the handler
- **acceptsDefault**: The default mime type to use when accepting a request body. */* will convert objects from json by default
- **defaultContentType**: The default mime type to use when writing content to a response. will convert objects to json by default
- **contentHandlers**: Content negotiation handlers keyed by the media type they handle. Media types must be all lower case.
    - **read**: A method to convert the request body to an object 
    - **write**: A method to convert the response body to a string
- **staticContentTypes**: Custom file extension to content-type mappings. These overwrite default mappings from: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Complete_list_of_MIME_types
- **staticCacheControl**: Custom value for the Cache-Control header of static files
- **decodePathParameters**: run decodeURIComponent(param.replace(/\+/g,"%20")) on each path parameter value. true by default.
- **decodeQueryParameters**: run decodeURIComponent(param.replace(/\+/g,"%20")) on each query parameter key and value. This is disabled by default. The recommended way to send data is via json in a request body.
- **watchFiles**: watch the files on disk for changes. Otherwise changes require a restart. false by default
- **cacheStatic**: cache static files in memory to increase performance. false by default.
- **secure**: use https for all traffic. All traffic to the http port will be redirected to https
    - **key**: The path to the key file to use for https
    - **cert**: The path to the certificate file to use for https
    - **port**: The port to listen on for https
    - **letsEncrypt**: Use let's encrypt to automatically issue trusted certificates. If this is set, key and cert are ignored.
        - **termsOfServiceAgreed**: Whether you agree to the Subscriber Agreement: https://letsencrypt.org/repository/
        - **directory**: The let's encrypt directory to use. Must me one of ['staging','production']
        - **domains**: The array of domains that you want to obtain a certificate for. Wildcard domains are not supported.
        - **certPath**: The directory to read certs from and place certs we generate in. 
        - **email**: The optional email to use for registering an account.

#### Prevent handler execution with Filters
To prevent the handler from executing the request, set res.finished = true. This will stop the request from processing through any more filters and will end the request.

## Routes
Routes are based entirely on their directory structure much like they are in apache.

Example dir:
- www
    - strains
        - gorillaGlue.js
        - blueDream.js
        - indica
            - index.js
        - sativa
            - index.js
            - smokeit.js
        - index.js

This would create the following route mappings:
- /strains/ > /www/strains/index.js
- /strains/gorillaGlue > /www/strains/gorillaGlue.js
- /strains/blueDream > /www/strains/blueDream.js
- /strains/indica/ > /www/strains/indica/index.js
- /strains/sativa/ > /www/strains/sativa/index.js
- /strains/sativa/smokeit > /www/strains/sativa/smokeit.js

#### Path variables
You can include path variables by prefixing the folder or file name with a $

Example dir:
- www
    - strains
        - $strainName
            - info

would handle:

- /www/strains/gorillaGlue/info
- /www/strains/blueDream/info

The path parameters are available in the pathParameters object on the first argument passed to the handler

The variable will be the folder or file name excluding the $, i.e. $strainName -> { strainName: 'gorillaGlue'}

**You can only have on variable file/folder within any given folder. This is because it would be ambiguous which one to use and thus the result couldn't be defined. 

#### Catchall path
You can make a handler handle all requests that start with the given path by appending a + to the file or folder name.

Example dir:
- www
    - strains+.js

would handle:

- /www/strains/gorillaGlue/info/something/more/stuff
- /www/strains/blueDream/dankness/allOfIt

##### Feature backlog (ordered by priority)
- authentication/authorization filter with default and per handler configuration
- compression
- HTTP/2 with server push
- caching filter
- multipart file handling
- Server side rendering (aka templating/mvc)
- proxy address trust and x-forwarded-for using proxy-addr 

### Breaking changes
breaking changes are tracked in the breaking-changes.log