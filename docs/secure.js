import { a, div, em, h3, li, p, strong, ul } from './fnelements.js'
import prismCode from './prismCode.js'


export default div( p( 'HTTPS can be enabled by setting the secure.key and secure.cert properties on the ',
                       a( { href: '#Config' }, 'config' ),
                       '. The default https port is 14420.' ),


                    h3( { id: 'let-s-encrypt-automated-public-ca-trusted-certs' },
                        'Let"s Encrypt automated public CA trusted certs' ),
                    p( 'Let"s encrypt is a free service that provides public trusted certificates to serve secure content to your users with.' ),
                    p( 'This service is provided by the ',
                       a( { href: 'https://www.abetterinternet.org/' }, 'Internet Security Research Group' ),
                       ' learn more ',
                       a( { href: 'https://letsencrypt.org/about/' }, 'Here' ),
                       '.' ),
                    p( 'To use this, you ',
                       strong( 'MUST' ),
                       ' be able to access your server from the internet at all of the specifieddomains on port 80 and 443. Other ports are not supported. ' ),
                    p( 'Once you can do that, set config.secure.letsEncrypt to an object with at least the following properties' ),
                    prismCode( `{
     termsOfServiceAgreed: true,
     directory: 'staging',
     domains: ["hightimes.com","www.hightimes.com"],
     certPath: __dirname +"/certs"
 }`
                    ),

                    h3( { id: 'termsofserviceagreed-true' }, 'termsOfServiceAgreed: true' ),
                    p( 'You must agree to the Subscriber Agreement found here: ',
                       a( { href: 'https://letsencrypt.org/repository/' }, 'https://letsencrypt.org/repository/' ) ),


                    h3( { id: 'directory-staging-' }, 'directory: "staging"' ),
                    p( 'The let"s encrypt directory to use. Must me one of ["staging","production"]. ' ),
                    p( 'Staging should be used to issue certificates for any pre-production purpose and has higher rate limits than production.' ),


                    h3( { id: 'domains-hightimes-com-www-hightimes-com-' },
                        'domains: ["hightimes.com","www.hightimes.com"]' ),
                    p( 'The list of domains that you want to obtain a certificate for',
                       em( 'Wildcard domains are not supported because they can only be verified with a dns challenge and that requires access to the domain"s dns configuration.' ) ),


                    h3( { id: 'certpath-opt-letsencrypt-certs-' }, 'certPath: "/opt/letsEncrypt/certs"' ),
                    p( 'The directory to read certs from and place certs we generate in. ' ),
                    p( em(
                        'Ensure the cert directory is not contained in the routeDir! It would be really bad if someone downloaded your private key!' ) ),
                    p( 'These must be stored on disk so they can be re-used. This is essential to avoid abusing the api and triggering rate limits.' ),
                    p( 'It"s preferred that multiple servers share the same copy of the files, locks are used to prevent clobbering when renewals happen.' ),
                    p( 'Renewal times are distributed throughout the range of minutes between two weeks before the expiration date and the expiration date to avoid multiple servers from trying to renew the same domains at the same time and breaking rate limits' ),
                    p( 'This also helps lower the chance of clobbering when renewing certificates.' ),
                    p( 'Watches are placed on the files so if any server renews the cert, it will be detected by all servers and the server will be re-initialized with the new cert.' ),
                    p( 'You can see the rate limits here: ',
                       a( { href: 'https://letsencrypt.org/docs/rate-limits/' }, 'https://letsencrypt.org/docs/rate-limits/' ) ),


                    h3( { id: 'overview-of-how-it-works' }, 'Overview of how it works' ),
                    p( 'If we don"t have a certificate already, or the certificate we have is up for renewal, we will place a new order for a certificate automatically.' ),
                    ul(
                        li( 'An account is created ore retrieved using either the specified account key, or a generated one.' ),
                        li( 'If a certificate key is provided it will be used to create the cert, one is generated if not provided.' ),
                        li( 'An order for a new certificate for the specified domains is placed to let"s encrypt.' ),
                        li( 'Let"s encrypt responds with a challenge containing a token and an authorization value.' ),
                        li( 'The authorization is served at the url /.well-known/acme-challenge/$token for the duration of the challenge.' ),
                        li( 'The server responds to Let"s encrypt saying the challenge is ready, then polls until let"s encrypt says the challenge is valid' ),
                        li( 'Let"s encrypt makes several GET /.well-known/acme-challenge/$token requests to domains specified' ),
                        li( 'Our polling process detects that the challenge was passed and the cert is ready' ),
                        li( 'The certs are downloaded and https is started/restarted on all servers watching the files' )
                    ),
                    p( 'Much better and far more detailed information can be found here: ',
                       a( { href: 'https://letsencrypt.org/how-it-works/' }, 'https://letsencrypt.org/how-it-works/' ) )
)