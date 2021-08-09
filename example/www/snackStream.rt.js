const { Readable } = require( 'stream' )

const snacks = [
    {
        name: 'oreos',
        deliciousness: 'mind boggling'
    },
    {
        name: 'doritos',
        deliciousness: 'fantastic'
    },
    {
        name: 'snicker',
        deliciousness: 'amazing'
    },
]

const writeSnacks = async bodyStream => {
    let p = Promise.resolve()
    for( let snack of snacks ) {
        p = writeSnack( bodyStream, snack )
    }
    return p
}

const writeSnack = async ( bodyStream, snack ) => bodyStream.push( `<li>Snack ${snack.name} is ${snack.deliciousness}</li>` )

module.exports = {
    GET: async () => ( {
        headers: {
            'Content-Type': 'text/html'
        },
        body: new Readable({
            read(){
                if(!this.writing){
                    this.writing = true
                    this.push( '<html lang="en"><body><ul>' )
                    writeSnacks( this )
                        .then( () => {
                            this.push( '</ul></body></html>' )
                            this.push( null )
                        } )
                }

            }
        } )
    } )
}