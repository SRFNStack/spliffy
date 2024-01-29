module.exports = {
  POST: async ({ url: { query }, bodyPromise }) => {
    const body = await bodyPromise
    if (typeof body !== 'object') {
      throw new Error('request body not parsed')
    }
    return { ...body, responseMessage: "I think we're parked man", query: query }
  }
}
