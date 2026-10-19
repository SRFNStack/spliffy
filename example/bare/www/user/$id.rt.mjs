export default {
  GET: ({ url }) => url.param('id'),
  DELETE: ({ url: { param, query } }) => ({ id: param('id'), query })
}
