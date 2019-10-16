import home from './home.js'
import fourOhFore from './404.js'
import routing from './routing.js'

import { fnbind, fnlink, pathState, route } from './fntags.js'
import { secondaryColor } from './constants.js'
import secure from './secure.js'
import staticFiles from './staticFiles.js'
import security from './security.js'
import config from './config.js'


const routes = [
    { url: '/', component: home, absolute: true },
    { url: '/routing', linkText: 'Routing', component: routing },
    { url: '/static', linkText: 'Static Files', component: staticFiles },
    { url: '/https', linkText: 'HTTPS', component: secure },
    { url: '/security', linkText: 'Security', component: security },
    { url: '/config', linkText: 'Config', component: config },
    // {url: "/reference", linkText: 'Reference', component: reference},
    { url: '.*', component: fourOhFore }
]

export const routeElements = () => routes.map( ( r ) => route( { path: r.url, absolute: !!r.absolute }, r.component ) )
export const routeNavItems = () =>
    routes
        .filter( r => r.linkText )
        .map(
            ( r ) => fnbind( pathState, () =>
                fnlink( {
                            to: r.url,
                            style: {
                                cursor: 'pointer',
                                padding: '12px',
                                'font-weight': 400,
                                'font-size': '18px',
                                'text-decoration': 'none',
                                color: pathState.info.currentRoute.startsWith( r.url ) ? 'limegreen' : 'inherit'
                            }
                        },
                        r.linkText
                )
            )
        )