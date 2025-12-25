import { strong, div, p, h3, h4, ul, li, code, span } from './fnelements.mjs'
import { fnlink } from './fnroute.mjs'
import prismCode from './prismCode.js'

const folder = (name) => span({ class: 'folder' }, name)
const file = (name) => span({ class: 'file' }, name)

export default div(
  h3('Static Files'),
  p('Spliffy isn\'t just for fancy JS handlers; it\'s also a high-performance static file server. Any file in your route directory that doesn\'t end in .rt.mjs (or .rt.js/.rt.cjs) will be served verbatim from disk.'),

  h4('How it Works'),
  p('The URL path maps directly to the file system. If you have a file at ', code('www/images/logo.png'), ', it will be available at ', code('/images/logo.png'), '.'),

  h4('Default Files (The "Index" Rule)'),
  p('To keep things clean, any file starting with "index." will be served as the default file for its directory. This works for .html, .txt, .png, or whatever else you\'ve got in the stash.'),
  
  ul({ class: 'file-tree' },
    li(folder('www'),
      ul(
        li(folder('about'),
           ul(
             li(file('index.html'))
           )
        ),
        li(file('index.html')),
        li(file('favicon.ico'))
      )
    )
  ),
  p('In this setup:'),
  ul(
    li(code('/'), ' serves ', code('www/index.html')),
    li(code('/about/'), ' serves ', code('www/about/index.html'))
  ),

  h4('Content Types & Mime Magic'),
  p('Spliffy automatically determines the ', code('Content-Type'), ' based on the file extension. We support all the standard types you\'d expect.'),
  p('Need something custom? You can add your own mappings in the ', fnlink({ to: '/config' }, 'config'), ':'),
  prismCode(`
{
    staticContentTypes: {
        '.spliff': 'image/png',
        '.herb': 'text/markdown'
    }
}`),

  h4('Performance & Caching'),
  p('We take performance seriously so you can stay relaxed:'),
  ul(
    li(strong('ETags'), ': Automatically generated and cached on startup. They are recalculated only if the file changes.'),
    li(strong('Cache-Control'), ': Default max-age is 10 minutes (600 seconds).'),
    li(strong('In-Memory Caching'), ': For lightning-fast responses, set ', code('cacheStatic: true'), ' in your config to keep files in RAM.')
  ),
  p('Custom cache settings can be applied via ', code('staticCacheControl'), ' in the config.'),

  h4('Restrictions'),
  p('To keep things secure and simple, static files only support the ', code('GET'), ' method. Any other method will result in a ', code('405 Method Not Allowed'), '.')
)