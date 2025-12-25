import { a, div, hr, p, h3, code } from './fnelements.mjs'
import prismCode from './prismCode.js'
export default div(
  p(
    'Spliffy supports express.js style middleware and works with some existing express.js middleware. '
  ),
  p(
    a({ href: 'https://www.passportjs.org/' }, 'Passport'), ' and ', a({ href: 'https://github.com/helmetjs/helmet' }, 'Helmet'), ' are supported and their use is encouraged.'
  ),
  p(
    'Middleware is a function that receives three arguments: ', code('request, response, next. ')
  ),
  p(
    'The request and response may be modified by middleware and do a lot of fun tricks. '
  ),
  p(
    'The next function, when called with no arguments, will continue to either the next middleware in the chain, or to the route handler if there is one.'
  ),
  p(
    'If anything is passed to next(), it\'s considered an error and the request is ended.'
  ),
  p('To handle errors in middleware, you can add middleware functions that take 4 parameters. ' +
        'The err that was passed to next or thrown is prepended to the usual arguments: ', code('err, request, response, next')),
  p(
    'You must either call next() or response.end() in your middleware or the server will hang indefinitely and the client will ultimately timeout.'
  ),
  p(
    'Middleware can either be added to the application config, exported as a variable on a controller, or a ',
    'file with the extension `.mw.mjs` can be placed in a route directory and it will be applied to all routes in that folder and all sub-folders.'
  ),

  p(
    'The middleware property can either be an array that applies to all methods, or it can be an object that ' +
        'applies only to the specified methods. There is a special ', code({ style: 'font-size: large;' }, 'ALL'),
    ' method that can be used to apply middleware to all methods and still provide other middleware for specific methods.'
  ),
  hr(),
  h3('Root config example'),
  prismCode(
`
import spliffy from '@srfnstack/spliffy'

spliffy( {
        routeDir: new URL('./www', import.meta.url).pathname,
        middleware: [(req, res, next)=>{
            console.log("Look at me! I'm in the middle!")
            next()
        }]
} )
`
  ),
  h3('Route example'),
  prismCode(
        `
export default {
    middleware: [ ( req, res, next ) => {
            if( req.user 
                && Array.isArray(req.user.roles) 
                && req.user.roles.indexOf( 'admin' ) > -1 
            ) {
                next()
                return
            }
            res.statusCode = 403
            res.statusMessage = 'Forbidden'
            res.end()
        }],
    POST: async ( { req: { user }, url: { param } } ) => 
        await doAdminStuff(user, param('adminStuffId'))
}
`
  ),
  h3('.mw.js file example'),
  p('Create a file named ', code({ style: 'font-size: large;' }, 'middleware.mw.mjs'),
    ' (middleware can be anything you want, i.e. ', code({ style: 'font-size: large;' }, 'requiresAuth.mw.mjs'), '). ' +
        'All middleware files will be applied in no specific order to all routes in the same directory and all routes in sub-directories.'
  ),
  prismCode(
        `
export default {
    middleware: { 
        ALL: [
            (req, res, next)=>{
                console.log("This middleware applies to everything under " + __dirname)
                next()
            },
            (err, req, res, next)=>{
                console.log("Handling error thrown in " + __dirname)
                next()
            }
        ],
        PUT:  [(req, res, next)=>{
            console.log("Put to route inside " + __dirname)
            next()
        }]
    }
}
`
  )
)
