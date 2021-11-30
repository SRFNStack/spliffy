
const htmlDoc = body => `<html><body>${body}</body></html>`

const form = htmlDoc(
`<form method="post">
    Name: <input name="name" type="text"><br/>
    Favorite Strain: <input name="favStrain" type="text"><br/>
    Preferred Style: <select name="prefStyle">
        <option value="bud">Bud</option>
        <option value="goo">Goo</option>
        <option value="edibles">Edibles</option>
        </select><br/>
    <button type="submit">Submit</button>
</form>`)

module.exports = {
  GET: () => ({
    headers: {
      'Content-Type': 'text/html'
    },
    body: form
  }),
  POST: async ({ bodyPromise }) => {
    const { name, favStrain, prefStyle } = await bodyPromise
    return {
      headers: {
        'Content-Type': 'text/html'
      },
      body: htmlDoc(`Hello ${name}, have some ${prefStyle} of ${favStrain}`)
    }
  }
}
