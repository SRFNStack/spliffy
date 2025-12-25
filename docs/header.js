import { div, header, img, a, span, button } from './fnelements.mjs'
import { goTo } from './fnroute.mjs'

const toggleMenu = () => {
  document.body.classList.toggle('mobile-open')
}

export default header({ class: 'top-bar' },
  div({ class: 'flex-center' },
    button({
      class: 'menu-toggle',
      onclick: toggleMenu,
      style: 'background: none; border: none; font-size: 1.5rem; color: var(--text-primary); cursor: pointer; margin-right: 10px; padding: 0;'
    }, '☰'),
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
    )
  ),
  a({ href: 'https://github.com/narcolepticsnowman/spliffy', target: '_blank' },
    img({ src: './GitHub-Mark-64px.png', style: 'height: 32px; filter: invert(1);' })
  )
)
