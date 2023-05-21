const fetch = require('node-fetch')

describe('cookies!', () => {
  it('loves cookies', async () => {
    const res = await fetch('http://localhost:11420/cookie', {
      headers: {
        cookie: 'username=cookiezzz; giveme=cookies;'
      }
    })
    const body = await res.json()
    expect(res.headers.get('set-cookie')).toEqual('Coooooooookie=crisps; Max-Age=604800; HttpOnly; SameSite=Lax, isCookieMonster=true')
    expect(body).toEqual({
      username: 'cookiezzz',
      giveme: 'cookies'
    })
  })
})
