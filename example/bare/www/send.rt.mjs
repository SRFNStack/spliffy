export default {
  GET: ({ res }) => { res.send({ sent: true }) },
  POST: ({ res }) => res.redirect('/elsewhere')
}
