export default {
  GET: ({ res }) => {
    res.setHeader('x-bare', 'yes')
    res.status(201)
    return 'created'
  },
  POST: () => ({ statusCode: 202, statusMessage: 'Whatever', headers: { 'x-bare': 'also' }, body: { ok: true } })
}
