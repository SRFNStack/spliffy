import { div, h3, li, p, strong, ul, span, code } from './fnelements.mjs'
import prismCode from './prismCode.js'

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
  ),
  h3({ id: 'declarative-responses' }, 'Declarative responses'),
  p('A handler that always answers the same way, give or take a value copied from the request, does not need to run javascript at all. ',
    'Describe the response up front with ', code('declarative()'), ' and export the result instead of a function. ',
    'The description is compiled once at startup and executed entirely inside µWebSockets.js, so requests to the route never enter javascript. ',
    'This is faster than any function handler, even a raw µWebSockets.js callback.'),
  prismCode(`import { declarative } from '@srfnstack/spliffy'

export default {
    // GET /strains/:strainName  ->  200 with the strain name as the body
    GET: declarative()
        .writeHeader('content-type', 'text/plain')
        .writeParameterValue('strainName')
        .end(''),
    // POST /strains/:strainName  ->  202 with a fixed body
    POST: declarative().writeStatus('202 Accepted').end('{"queued":true}')
}`),
  p('The response can write a status, headers and body text, and copy values from the request:'),
  ul(
    li(code('writeParameterValue(name)'), ': a path parameter, by the name of the $ folder or file'),
    li(code('writeQueryValue(name)'), ': a query parameter'),
    li(code('writeHeaderValue(name)'), ': a request header'),
    li(code('writeBody()'), ': the request body')
  ),
  p('Nothing runs per request, so middleware does not apply: a route file that has middleware, ',
    'or that is used as the notFoundRoute or defaultRoute, fails to load if it exports a declarative response. ',
    'Values are copied as they appear on the wire, path and query parameters are not decoded.')
  // TODO update docs for middleware
)
