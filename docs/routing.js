import { div, h3, li, p, strong, ul, span } from './fnelements.mjs'

const folder = (name) => span({ class: 'folder' }, name)
const file = (name) => span({ class: 'file' }, name)

export default div(
  h3('Routing'),
  p('Routes are based entirely on their directory structure much like they are in apache.'),
  p('Example dir:'),
  ul({ class: 'file-tree' },
    li(folder('www'),
      ul(
        li(folder('strains'),
          ul(
            li(file('gorillaGlue.rt.mjs')),
            li(file('blueDream.rt.mjs')),
            li(folder('indica'),
              ul(
                li(file('index.rt.mjs'))
              )
            ),
            li(folder('sativa'),
              ul(
                li(file('index.rt.mjs')),
                li(file('smokeit.rt.mjs'))
              )
            ),
            li(file('index.rt.mjs'))
          )
        )
      )
    )
  ),
  p('This would create the following route mappings:'),
  ul(
    li('/strains/ > /www/strains/index.rt.mjs'),
    li('/strains/gorillaGlue > /www/strains/gorillaGlue.rt.mjs'),
    li('/strains/blueDream > /www/strains/blueDream.rt.mjs'),
    li('/strains/indica/ > /www/strains/indica/index.rt.mjs'),
    li('/strains/sativa/ > /www/strains/sativa/index.rt.mjs'),
    li('/strains/sativa/smokeit > /www/strains/sativa/smokeit.rt.mjs')
  ),

  h3({ id: 'path-variables' }, 'Path variables'),
  p('You can include path variables by prefixing the folder or file name with a $'),
  p('Example dir:'),
  ul({ class: 'file-tree' },
    li(folder('www'),
      ul(
        li(folder('strains'),
          ul(
            li(folder('$strainName'),
              ul(
                li(file('info.rt.mjs'))
              )
            )
          )
        )
      )
    )
  ),
  p('would handle:'),
  ul(
    li('/www/strains/gorillaGlue/info'),
    li('/www/strains/blueDream/info')
  ),
  p('The path parameters are available via the ', strong('param'), ' object on the first argument passed to the handler, pass in the name to get the value'),
  p('The variable will be the folder or file name excluding the $, i.e. $strainName -> { strainName: "gorillaGlue"}'),
  p('**You can only have on variable file/folder within any given folder. This is because it would be ambiguous which one to use and thus the result couldn\'t be defined. '),

  h3({ id: 'catchall-path' }, 'Catchall path'),
  p('You can make a handler handle all requests that start with the given path by appending a + to the file or folder name.'),
  p('Example dir:'),
  ul({ class: 'file-tree' },
    li(folder('www'),
      ul(
        li(file('strains+.rt.mjs'))
      )
    )
  ),
  p('would handle:'),
  ul(
    li('/www/strains/gorillaGlue/info/something/more/stuff'),
    li('/www/strains/blueDream/dankness/allOfIt')
  )
  // TODO update docs for middleware

)
