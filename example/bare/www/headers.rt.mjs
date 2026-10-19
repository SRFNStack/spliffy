export default {
  GET: ({ res }) => {
    res.setHeader('x-bare', 'yes')
    res.status(201)
    return 'created'
  },
  POST: () => ({ statusCode: 202, statusMessage: 'Whatever', headers: { 'x-bare': 'also' }, body: { ok: true } }),
  PUT: () => ({ statusCode: 203, headers: { 'x-bare': 'desc', 'x-multi': ['1', '2'] }, body: 'text body' }),
  DELETE: () => ({ headers: { 'x-bare': 'nobody' } })
}
