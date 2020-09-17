module.exports = {
    middleware: [(req, res, next)=>{
        console.log("This middleware applies to everything under /middleware")
        next()
    }]
}