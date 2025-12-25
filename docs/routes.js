import home from './home.js'
import routing from './routing.js'

import { fnlink, pathState, route } from './fnroute.mjs'
import streaming from './streaming.js'
import staticFiles from './staticFiles.js'
import config from './config.js'
import middleware from './middleware.js'
import websockets from './websockets.js'

const routes = [
  { url: '/', component: home, absolute: true },
  { url: '/routing', linkText: 'Routing', component: routing },
  { url: '/static', linkText: 'Static Files', component: staticFiles },
  { url: '/middleware', linkText: 'Middleware', component: middleware },
  { url: '/streaming', linkText: 'Streaming', component: streaming },
  { url: '/websocket', linkText: 'WebSockets', component: websockets },
  { url: '/config', linkText: 'Config', component: config },
  // {url: "/reference", linkText: 'Reference', component: reference},
  { url: '.*', component: home }
]

export const routeElements = () => routes.map((r) => route({ path: r.url, absolute: !!r.absolute }, r.component))
export const routeNavItems = () =>
  routes
    .filter(r => r.linkText)
    .map(
      (r) =>
        fnlink({
          to: r.url,
          class: pathState.bindAttr(() =>
            'nav-link' + (pathState().currentRoute.startsWith(r.url) ? ' active' : '')
          )
        },
        r.linkText
        )
    )
