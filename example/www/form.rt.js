
const htmlDoc = body => `<html><body>${body}</body></html>`

module.exports = {
    GET: () => ( {
        headers: {
            'Content-Type': 'text/html'
        },
        body: htmlDoc(`
            <form method="post">
            Name: <input name="name" type="text"><br/>
            Favorite Strain: <input name="favStrain" type="text"><br/>
            Preferred Style: <select name="prefStyle">
                <option value="bud">Bud</option>
                <option value="goo">Goo</option>
                <option value="edibles">Edibles</option>
                </select><br/>
            <button type="submit">Submit</button>
            </form>`)
    } ),
    POST: ( { body: {name, favStrain, prefStyle}} ) => ({
        headers: {
            'Content-Type': 'text/html'
        },
        body: htmlDoc(`Hello ${name}, have some ${prefStyle} of ${favStrain}`)
    })
}