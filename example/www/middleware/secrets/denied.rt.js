module.exports = {
    middleware:{
        GET: [(req, res, next)=>{
            console.log('Everyone is unauthorized!')
            next({status: 401, message: 'Get Outta Here!'})
        }]
    },
    GET: ()=>console.log("Can't get here")
}