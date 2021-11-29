const fs = require('fs')
const { promisify } = require('util')
const pipeline = promisify(require('stream').pipeline)
const catEatingPancakePath = require('path').join(__dirname, '../serverImages/cat_eating_pancake.jpg')

module.exports = {
  GET: async ({ res }) => {
    res.assignHeaders({
      'Content-Type': 'img/jpeg',
      'Content-Disposition': 'inline; filename="cat_eating_pancake.jpg"'
    })
    return pipeline(
      fs.createReadStream(catEatingPancakePath),
      res.getWritable()
    )
  }
}
