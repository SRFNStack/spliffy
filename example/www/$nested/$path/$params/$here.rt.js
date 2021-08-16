module.exports = {
    GET: ( { url: { pathParameters: { nested, path, params, here } } } ) => `Nested: /${nested}/${path}/${params}/${here}/`
}