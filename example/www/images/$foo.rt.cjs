module.exports = {
  GET: ({ url }) => `got parameter ${url.param('foo')}`
}
