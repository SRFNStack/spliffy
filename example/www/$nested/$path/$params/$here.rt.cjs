module.exports = {
  GET: ({ url: { param } }) => `${param('nested')} ${param('path')} ${param('params')} ${param('here')}, never gonna let you down`
}
