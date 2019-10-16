//30px header, 25px text fntags - (15px text, vertical center aligned) functions as tags. Write javascript instead of html
//50px header with just text to
import { blockquote, div, h1, header, img, nav, p } from './fnelements.js'
import { primaryColor } from './constants.js'
import { routeNavItems } from './routes.js'
import { goTo } from './fntags.js'

export default header( { class: 'container text-center' },
         div( { class: 'flex-center', style: 'flex-wrap: wrap; padding-bottom: 10px; cursor: pointer',
              onclick: ()=>goTo('/')},
              h1(
                  img( {
                           src: 'spliffy_logo_text_small.png',
                           alt: 'Spliffy',
                           title: 'Spliffy Logo',
                            style: 'height: 125px'
                       } ) ),
              blockquote(
                  p( 'directory based routing with js request handlers and static file serving' )
              ),
         ),
         nav( { class: 'flex-center', style: 'border-bottom: solid 1px darkgray; background-color: ' + primaryColor },
              div( { class: 'flex-center noselect' }, ...routeNavItems() ) )
    )
