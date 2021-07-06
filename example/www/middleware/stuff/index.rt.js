module.exports = {
    POST: ({body}) => "index post for "+JSON.stringify(body),
    PUT: ({body}) => "index put for "+JSON.stringify(body),
    GET: ({body}) => "index get for "+JSON.stringify(body)
}