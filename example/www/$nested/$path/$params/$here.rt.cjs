module.exports = {
  GET: ({ url: { pathParameters: { nested, path, params, here } } }) => `${nested} ${path} ${params} ${here}, never gonna let you down`
}
