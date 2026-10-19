// handlers that list what they take from the context get only that read before the uws request
// dies, a handler that takes the whole context gets everything
export default {
  // destructured and async: url and body must survive the await
  POST: async ({ url, body }) => {
    await new Promise(resolve => setTimeout(resolve, 2))
    return { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: url.query, body }) }
  },
  // whole context and async: headers must survive the await
  PUT: async function (ctx) {
    await new Promise(resolve => setTimeout(resolve, 2))
    return { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tag: ctx.headers['x-tag'], body: ctx.body }) }
  }
}
