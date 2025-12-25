import { div, header, img, a, span } from './fnelements.mjs'
import { goTo } from './fnroute.mjs'

export default header({ class: 'top-bar' },
  div({
    class: 'logo-container',
    style: 'cursor: pointer',
    onclick: () => goTo('/')
  },
  img({
    src: 'spliffy_logo_text_small.png',
    alt: 'Spliffy',
    class: 'logo-img'
  }),
  span({ class: 'logo-text' }, 'Docs')
  ),
  a({ href: 'https://github.com/narcolepticsnowman/spliffy', target: '_blank' },
    img({ src: './GitHub-Mark-64px.png', style: 'height: 32px; filter: invert(1);' })
  )
)