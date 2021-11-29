module.exports = {
  middleware: {
    GET: [(req, res, next) => {
      res.headers['route-mw-applied'] = true
      console.log('got my secrets')
      next()
    }]
  },
  POST: ({ body }) => 'Got post for ' + JSON.stringify(body),
  PUT: ({ body }) => 'Got put for ' + JSON.stringify(body),
  GET: ({ body }) => 'Got get for ' + JSON.stringify(body),
  PATCH: ({ body }) => 'Got patch for ' + JSON.stringify(body),
  DELETE: ({ body }) => 'Got delete for ' + JSON.stringify(body)
}
