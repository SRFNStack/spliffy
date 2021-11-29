const fs = require('fs')
const catEatingPancakePath = require('path').join(__dirname, '../serverImages/cat_eating_pancake.jpg')

module.exports = {
  GET: async () => ({
    headers: {
      'Content-Type': 'img/jpeg',
      'Content-Disposition': 'inline; filename="cat_eating_pancake.jpg'
    },
    body: fs.createReadStream(catEatingPancakePath)
  })
}
