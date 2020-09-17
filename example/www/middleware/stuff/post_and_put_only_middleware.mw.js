module.exports = {
    middleware: {
        ALL: [(req, res, next)=>{
            console.log("This middleware applies to everything under /middleware/stuff")
            next()
        }],
        PUT:  [(req, res, next)=>{
            console.log("Put to /middleware/stuff")
            next()
        }],
    }
}