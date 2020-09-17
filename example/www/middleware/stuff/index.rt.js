module.exports = {
    POST: ({body}) => "Got post for "+JSON.stringify(body),
    PUT: ({body}) => "Got put for "+JSON.stringify(body),
    GET: ({body}) => "Got get for "+JSON.stringify(body)
}