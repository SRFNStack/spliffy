import { div, h3, img } from './fnelements.mjs'

export default div(
  h3('404 Page not found'),
  div(img({ src: 'http://placekitten.com/500/500' }))
)
