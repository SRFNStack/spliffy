module.exports = {
    middleware: [(req,res,next)=>{throw new Error("Made to fail")}],
}