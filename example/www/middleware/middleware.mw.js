module.exports = {
    middleware: [(req, res, next)=>{
        console.log("This middleware applies to everything under /middleware")
        res.headers['middleware-was-here'] = true
        next()
    }]
}