const {currentRequest, log} = require('../../src/index.js')

module.exports = {
    performShenanigans: ()=>{
        log.gne("Shenanigans at path", currentRequest().url)
    }
}
