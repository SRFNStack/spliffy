import { div, h3, li, p, ul } from './fnelements.js'
import prismCode from './prismCode.js'

export default div( p( 'JWT is provided by default to provide authentication and stateless session handling.' ),

                    p( 'Permissions and authentication be applied in multiple ways' ),
                    ul(
                        li( 'Path matching' ),
                        li( 'Specific routes' ),
                        li( 'Specific methods' )
                    ),


                    h3( { id: 'pathMatching' }, 'Path Matching' ),
                    p( 'A list of regex patterns that will require authentication to access' ),

                    p( prismCode(
                        'config.auth.authRequired = ["/secrets","/treasure","/candy"]' )
                    ),

                    p( 'You can override requiring auth by adding patterns to noAuthRequired. This is useful when you want to secure everything except a few routes.' ),
                    p( prismCode(
                        'config.auth.noAuthRequired = ["/login","/home","/"]' ) ),

                    h3( 'App wide permissions' ),
                    p( 'Use app wide permissions to specify users and roles that are required to use any end point.' ),
                    p( 'Routes matched by ', prismCode( 'config.auth.noAuthRequired) will still not required these permissions.' ),
                       p( prismCode( 'config.auth.appAllow = { users: [\'Space Cowboy\'], roles:[\'joker\',\'mid-night toker\'] ] }' ) ),

                       h3( 'Path Matching permissions' ),
                       p( 'To specify roles for a path pattern, add an object to matchAllow with the pattern and the allowed users and roles' ),
                       p( prismCode( 'config.auth.matchAllow = { users: [\'Steve\'], roles:[\'joker\', \'smoker\'] ] }' ) ),

                       h3( 'Specific Routes and Methods' ),
                       p( 'To specify users and roles on a route or method, change your handler export to the following form' ),
                       prismCode( `module.exports = {
    allow: {users: ['space cowboy', 'gangster of love' ], roles: ['joker', 'smoker', 'mid-night toker']},
    handlers: {
        GET: {
            allow: {users: ['Steve Miller'], roles: ['maurice']},
            handler: ({url, body, headers, req, res}) => {
                body: "hello Mr. Miller"
            }
        }
    }
}
`
                       ),

                       h3( 'JWT Config' ),
                       p( 'Spliffy uses the jsonwebtoken library for jwt. You should at least set the issuer and audience on the jwt config, but it is not required.' ),
                       p( 'You can pass any additional configuration to the ', prismCode( 'jwt.sign()' ), ' and ',
                          prismCode( 'jwt.verify' ),
                          ' methods by setting them on either signOpts or verifyOpts of the auth config.' )
                    )
)