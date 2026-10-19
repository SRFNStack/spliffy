// application/octet-stream bodies arrive as the bytes that were sent and go back the same way
export default {
  POST: async ({ bodyPromise }) => ({ headers: { 'content-type': 'application/octet-stream' }, body: await bodyPromise })
}
