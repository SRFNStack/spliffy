const fetch = require('node-fetch')

const expectedForm = `<html><body><form method="post">
    Name: <input name="name" type="text"><br/>
    Favorite Strain: <input name="favStrain" type="text"><br/>
    Preferred Style: <select name="prefStyle">
        <option value="bud">Bud</option>
        <option value="goo">Goo</option>
        <option value="edibles">Edibles</option>
        </select><br/>
    <button type="submit">Submit</button>
</form></body></html>`

describe('form test', () => {
  it('Loads the html from /form', async () => {
    const res = await fetch('http://localhost:11420/form')
    const form = await res.text()
    expect(res.status).toBe(200)
    expect(form).toEqual(expectedForm)
  })

  it('Form consumes url encoded data and returns expected html', async () => {
    const res = await fetch('http://localhost:11420/form', {
      method: 'POST',
      body: 'name=Jerry&favStrain=Bruce%20Banner&prefStyle=bud',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      }
    })
    const formResponse = await res.text()
    expect(res.status).toBe(200)
    expect(formResponse).toEqual('<html><body>Hello Jerry, have some bud of Bruce Banner</body></html>')
  })
})
