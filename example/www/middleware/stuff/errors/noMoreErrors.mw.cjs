module.exports = {
  middleware: [(err, req, res, next) => {
    res.statusCode = 200
    res.statusMessage = 'Everything is fine here'
    res.headers['error-mw-applied'] = true
    res.end(err.message)
    next()
  }]
}
