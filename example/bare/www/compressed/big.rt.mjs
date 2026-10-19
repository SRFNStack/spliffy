import stream from 'stream'

const items = []
for (let i = 0; i < 300; i++) items.push({ id: i, name: `item ${i}`, tags: ['a', 'b', 'c'], price: i * 7 })
export const payload = { items, count: items.length }
const text = JSON.stringify(payload)

export default {
  // one piece, compressed in one call
  GET: () => payload,
  // small bodies stay as they are
  POST: () => 'tiny',
  // written in pieces, compressed on a stream
  PUT: () => {
    const readable = new stream.Readable({ read () {} })
    const half = Math.floor(text.length / 2)
    setTimeout(() => {
      readable.push(text.slice(0, half))
      readable.push(text.slice(half))
      readable.push(null)
    }, 2)
    return { headers: { 'content-type': 'application/json' }, body: readable }
  },
  // binary content types are left alone
  PATCH: () => ({ headers: { 'content-type': 'image/png' }, body: Buffer.alloc(4096, 1) })
}
