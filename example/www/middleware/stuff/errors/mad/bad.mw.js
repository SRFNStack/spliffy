module.exports = {
    middleware: [(req,res,next)=>{
        res.headers['broke-mw-applied'] = true
        throw new Error("Made to fail")
    }],
}