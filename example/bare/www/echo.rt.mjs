export default {
  // the request is read after the handler has already yielded, so it must have been cached
  GET: async ({ req }) => {
    await new Promise(resolve => setTimeout(resolve, 5))
    return { host: req.headers.host, query: req.query, path: req.path, url: req.url }
  },
  // not named body, that would make the return value a response descriptor
  POST: async ({ bodyPromise, headers }) => ({ received: await bodyPromise, contentType: headers['content-type'] }),
  PUT: ({ bodyPromise }) => bodyPromise.then(body => ({ isBuffer: Buffer.isBuffer(body), length: body.length }))
}
