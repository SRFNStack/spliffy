module.exports = {
  middleware: {
    ALL: [(req, res, next) => {
      console.log('This middleware applies to everything under /middleware/stuff')
      res.headers['all-mw-applied'] = true
      next()
    }],
    PUT: [(req, res, next) => {
      console.log('Put to /middleware/stuff')
      res.headers['put-mw-applied'] = true
      next()
    }]
  }
}
