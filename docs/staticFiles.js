import { a, div, p } from './fnelements.mjs'
import {fnlink} from './fnroute.mjs'

export default div(p('Any non-js files will be served verbatim from disk.'),
  p('Any file prefixed with "index." (i.e. index.html, index.txt, index.png) will be served as the default file in the directory they are in.'),
  p('The extension determines the content-type of the file for the known types listed at ',
    a({ href: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Complete_list_of_MIME_types' },
      'mozilla.org')
  ),
  p('You can also add custom extension to content-type mappings by setting the staticContentTypes property on the ',fnlink({ to: '/config' }, 'config'),'.'),
  p('GET is the only supported request method for static files, all other request methods will result in a 405 Method Not Allowed.'),
  p('ETags will be generated on startup and will be recalculated if the file content changes. The cache-control max-age is set to 10min by default for static files.'),
  p('You can configure this with the staticCacheControl property of the ',
    fnlink({ to: '/config' }, 'config'),
    '.'),
  p('You can cache files in memory by setting cacheStatic to true on the config.')
)
