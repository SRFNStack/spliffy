import { goTo, pathState } from './fntags.js'
import { h3, hr, p, section, span } from './fnelements.js'

export default ( title, ...content ) => section(
    h3( { id: title }, title,
        span( {
                  style: 'cursor: pointer',
                  title: title,
                  onclick: ( e ) => {
                      goTo( `${pathState.info.currentRoute}#${encodeURIComponent( title )}` )
                  }
              },
              ' \uD83D\uDD17'
        ) ),
    ...
        content.map( c => typeof c === 'string' ? p( c ) : c ),
    hr()
)