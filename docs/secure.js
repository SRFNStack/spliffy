import { a, br, div, p } from './fnelements.js'


export default div(
    p(
        'HTTPS can be enabled by setting the secure.key and secure.cert properties on the ',
        a( { href: '#Config' }, 'config' ),
        'The default https port is 14420.'
    ),
    p(
        "Let's encrypt can be used to automatically manage ssl certificates for your application.",br(),
        "Let's encrypt support is provided via ",
        a({href: "https://www.npmjs.com/package/greenlock-express"},"greenlock-express"),
        ".",br(),
        "To enable greenlock, set the secure.greenlock property to an object. This object is passed to the init function of the greenlock-express lib. ",

      )
)
