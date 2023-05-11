import { a, b, div, h2, h3, h4, hr, li, p, pre, strong, ul } from './fnelements.mjs'
import prismCode from './prismCode.js'
import { fnlink } from './fnroute.mjs'

export default div({ class: 'flex-center', style: 'flex-direction: column; font-size: 16px;' },
  h2({ id: 'getting-started' }, 'Getting started'),
  p('Create a directory for your app'),
  p(prismCode('mkdir -p ~/app/www')),
  p('Install spliffy'),
  p(prismCode('cd ~/app && npm install @srfnstack/spliffy')),
  p('Create a handler for the desired route name (a regular js file with the suffix .rt.js) '),
  p(prismCode('vi ~/app/www/spliffy.rt.js')),
  prismCode(`
module.exports = {
    GET:() => ({hello: "spliffy"})
}`),
  p('Create the start script, ', prismCode('vi ~/app/serve.js')),
  pre(prismCode(`
require('spliffy')({
    routeDir: __dirname+ '/www'
})`)),
  p('The spliffy.rt.js file in ~/app/www creates the route',
    prismCode('/spliffy')),
  p('See ', fnlink({ to: '/config' }, 'Config'), ' for a complete set of options.'),
  p('routeDir is the only required property and should be an absolute path.'),
  p('10420 is the default port for http, and can be changed by setting the port in the config'),
  p('start the server', prismCode('node ~/app/serve.js')),
  p('Go to ', prismCode('127.0.0.1:10420/spliffy')),

  h3({ id: '-examples-https-github-com-narcolepticsnowman-spliffy-tree-master-example-' },
    a({ href: 'https://github.com/narcolepticsnowman/spliffy/tree/master/example' }, 'Examples')),
  h3({ id: 'js-request-handler' }, 'JS Request Handler'),
  pre(prismCode(`module.exports = {
    GET: ({url, bodyPromise, headers, req, res}) => {
        body: "hello Mr. Marley"
    }
}`
  )),
  p('The exported properties are all caps request methods, any request method is allowed.'),
  p('Files named index.rt.js can be created to handle the route of the name of the folder just like in apache.'),
  h3({ id: 'handler-arguments' }, 'Handler arguments:'),
  ul(
    li(strong('url'), ': An object containing path and parameter information about the url',
      ul(
        li(strong('path'), ': The path of the current request'),
        li(strong('query'),
          ': An object containing the query parameters. Not decoded by default. This can be configured by setting the decodeQueryParameters to true.'),
        li(strong('pathParameters'),
          ': parameters that are part of the path. Not decoded by default. This can be configured by setting the decodePathParameters to true.')
      )
    ),
    li(strong('bodyPromise'), ': A promise that resolves to the request body'),
    li(strong('headers'), ': The request headers'),
    li(strong('req'), ': A µWebSockets.js request adapted to function like an express request'),
    li(strong('res'), ': A µWebSockets.js response adapted to function like an express response')
  ),

  h4('Set Cookie'),
  p('To set a cookie, use res.setCookie().'),
  p('Arguments are passed verbatim to ',
    a({ href: 'https://www.npmjs.com/package/cookie#cookieserializename-value-options' },
      'cookie.serialize')
  ),
  hr(),

  h3({ id: 'handler-return' }, 'What to return from the handler'),
  p('The handler can return any kind of data and it will be serialized if there is a serializer for the specified content-type.' +
        ' The default, application/json, is used by default when returning an object.'),
  p('If the returned value is Falsey, a 200 OK is returned.'),
  p('If the returned value is a promise, it will be resolved and handled as usual.'),
  p('To set the statusCode, headers, etc, you must either ',
    b('return'), 'or ', b('throw'),
    ' an object with a body property for the body and optionally one or more of the following properties'),
  prismCode(`{
    headers: {
        "cache-control": 'no-cache'
    },
    body: {
        some: 'object'
    },
    statusCode: 420,
    statusMessage: "Enhance Your Calm"
}`
  )
)
