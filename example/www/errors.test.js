const fetch = require('node-fetch')

const expectations = [
  {
    statusCode: '400',
    statusMessage: 'Bad Request',
    body: { errors: ['big bad request'] }
  },
  {
    statusCode: '420',
    statusMessage: 'Enhance Your Calm',
    body: { errors: ['chill out dude'] }
  },
  {
    statusCode: '503',
    statusMessage: 'Service Unavailable',
    body: { errors: ['not home right now'] }
  },
  {
    statusCode: '500',
    statusMessage: 'Internal Server Error',
    body: { errors: ['broke af'] }
  }
]

describe('errors!', () => {
  it('sets the status code, status message, and body from the error', async () => {
    for (const expectation of expectations) {
      const res = await fetch(`http://localhost:11420/errors?statusCode=${expectation.statusCode}`)
      const body = await res.json()
      expect(res.status).toBe(parseInt(expectation.statusCode))
      expect(res.statusText).toBe(expectation.statusMessage)
      expect(body).toEqual(expectation.body)
    }
  })
})
