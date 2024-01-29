module.exports = {
  middleware: {
    GET: [(req, res, next) => {
      if (req.spliffyUrl.query.isAuthorized) {
        console.log('They said they were authorized...')
        next()
      } else {
        console.log('Everyone is unauthorized!')
        res.send({ statusCode: 401, statusMessage: 'Get Outta Here!' })
        next()
      }
    }]
  }
}
