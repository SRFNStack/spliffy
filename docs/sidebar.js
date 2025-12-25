import { div, nav } from './fnelements.mjs'
import { routeNavItems } from './routes.js'

export default nav({ class: 'sidebar' },
  div({ class: 'nav-list' },
    ...routeNavItems()
  )
)
