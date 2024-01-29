module.exports = {
  GET: ({ req, res }) => {
    res.setCookie('Coooooooookie', 'crisps', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    })
    res.setCookie('isCookieMonster', 'true')
    return {
      ...req.cookies
    }
  }
}
