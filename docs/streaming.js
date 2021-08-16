import { h3, div, p, code } from './fnelements.js'
import prismCode from './prismCode.js'

export default div(
    h3( 'Streaming Request' ),
    p(
        'By default the entire request is read into memory. In order to use a readable instead, set the property ',
        code( 'streamRequestBody' ), ' to true.',
    ),
    p(
        'This can be set at the route level to apply to all methods'
    ),
    prismCode( `
module.exports = {
    streamRequestBody: true,
    POST: async ( { url: { query: { filename = 'foo.dat' } }, body } ) => promisifiedPipeline(
        body,
        fs.createWriteStream( path.join( os.homedir(), filename ) )
    )
}        
    ` ),
    p( 'And at the handler level by setting the handler as an object' ),
    prismCode( `
module.exports = {
    POST: {
        streamRequestBody: true,
        handler: async ( { url: { query: { filename = 'foo.dat' } }, body } ) => promisifiedPipeline(
            body,
            fs.createWriteStream( path.join( os.homedir(), filename ) )
        )
    }
}    
    ` ),
    h3( 'Streaming Response' ),
    p(
        'Instead of returning the body as a whole from the handler, you can stream the response.',
    ),
    p(
        'Headers are sent before the first write, and cannot be modified after.'
    ),
    p(
        'The best way is to use ',code('res.asWritable()'),' to get a stream.Writable in conjunction with pipeline.'
    ),
    prismCode( `
GET: async ({res}) => promisifiedPipeline(
    fs.createReadStream(catEatingPancakePath),
    res.getWritable()
)
    ` ),
    p('You could also write directly to the response. '),
        p('If using this method, you must set ',code('res.streaming=true'),' before returning from the handler to ensure proper handling. '),
        p('You must also ensure that res.end() is called when you\'re done or the request will hang indefinitely and will' +
        ' eventually run your process out of memory as more requests are handled.'
    ),
    prismCode( `
GET: async ({res}) => {
    res.headers['Content-Type'] = 'text/html'
    res.streaming = true
    res.write('<html lang="en"><body>')
    writeBody(res).finally(()=>{
        res.write('</body></html>')
        res.end()
    })
}
    ` ),
)
