module.exports = {
    POST: ({url, body}) => {
        if(typeof body !== 'object'){
            throw "error"
        }
        return {...body, responseMessage:"I think we're parked man", query: url.query}
    }
}