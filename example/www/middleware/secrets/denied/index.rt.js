module.exports = {
    GET: ({res})=>{
        res.headers['route-was-hit'] = true
        return "Can't get here"
    }
}