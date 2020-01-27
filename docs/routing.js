import { div, h3, li, p, pre, strong, ul } from './fnelements.js'
import prismCode from './prismCode.js'

export default div(
    p( 'Routes are based entirely on their directory structure much like they are in apache.' ),
    p( 'Example dir:' ),
    ul(
        li( 'www',
            ul(
                li( 'strains',
                    ul(
                        li( 'gorillaGlue.js' ),
                        li( 'blueDream.js' ),
                        li( 'indica',
                            ul(
                                li( 'index.js' )
                            )
                        ),
                        li( 'sativa',
                            ul(
                                li( 'index.js' ),
                                li( 'smokeit.js' )
                            )
                        ),
                        li( 'index.js' )
                    )
                )
            )
        )
    ),
    p( 'This would create the following route mappings:' ),
    ul(
        li( '/strains/ > /www/strains/index.js' ),
        li( '/strains/gorillaGlue > /www/strains/gorillaGlue.js' ),
        li( '/strains/blueDream > /www/strains/blueDream.js' ),
        li( '/strains/indica/ > /www/strains/indica/index.js' ),
        li( '/strains/sativa/ > /www/strains/sativa/index.js' ),
        li( '/strains/sativa/smokeit > /www/strains/sativa/smokeit.js' )
    ),


    h3( { id: 'path-variables' }, 'Path variables' ),
    p( 'You can include path variables by prefixing the folder or file name with a $' ),
    p( 'Example dir:' ),
    ul(
        li( 'www',
            ul(
                li( 'strains',
                    ul(
                        li( '$strainName',
                            ul(
                                li( 'info' )
                            )
                        )
                    )
                )
            )
        )
    ),
    p( 'would handle:' ),
    ul(
        li( '/www/strains/gorillaGlue/info' ),
        li( '/www/strains/blueDream/info' )
    ),
    p( 'The path parameters are available in the ',strong('pathParameters'),' object on the first argument passed to the handler' ),
    p( 'The variable will be the folder or file name excluding the $, i.e. $strainName -> { strainName: "gorillaGlue"}' ),
    p( '**You can only have on variable file/folder within any given folder. This is because it would be ambiguous which one to use and thus the result couldn"t be defined. ' ),


    h3( { id: 'catchall-path' }, 'Catchall path' ),
    p( 'You can make a handler handle all requests that start with the given path by appending a + to the file or folder name.' ),
    p( 'Example dir:' ),
    ul(
        li( 'www',
            ul(
                li( 'strains+.js' )
            )
        )
    ),
    p( 'would handle:' ),
    ul(
        li( '/www/strains/gorillaGlue/info/something/more/stuff' ),
        li( '/www/strains/blueDream/dankness/allOfIt' )
    ),
    h3( { id: 'filters' }, 'Filters' ),
    p( 'Requests can be filtered using functions. The filter must return an object or no value. ' ),
    p( 'If an object is returned, it\'s properties will be included on the object passed to any remaining filters and the request handler.' ),
    p( 'This can be used for injecting any kind of data into your handlers.' ),
    p( 'To stop execution of filters, and end the request,' ),

    h3( { id: 'prevent-handler-execution-with-filters' }, 'Prevent handler execution with Filters' ),
    p( 'To prevent the handler from executing the request, set res.finished = true. This will stop the request from processing through any more filters and will end the request.' ),

    h3( { id: 'route-and-handler-metadata' }, 'Route and Handler Metadata' ),
    p( 'You may pass additional information to filters or request handlers on each request at the route level and at each method level.' ),
    p( 'To pass route data you must set the ',
       strong( 'handlers' ),
       ' property on your default export, then all other properties are passed to filters and handlers as the ',
       strong( 'routeInfo' ),
       ' property.' ),
    p( 'To pass method specific data set the method to an object with a ',
       strong( 'handler' ),
       ' property, then all other properties will be passed as the ',
       strong( 'methodInfo' ),
       ' property.' ),
    p( 'This is useful for cases where a filter or handler needs to know something about the route or handler.' ),
    pre( prismCode( `module.exports = {
    words: "Actin' funny, but I don't know why",
    handlers: {
        GET: {
            words: async ()=>"'Scuse me while I kiss the sky",
            handler: async ({url, body, headers, req, res, routeMeta, handlerMeta}) => ({
                body: {
                    song: {
                        title: 'Purple Haze',
                        artist: 'Jimi Hendrix',
                        words: routeMeta.words + (await handlerMeta.words())
                    }
                }
            })
        }
    }
}`
    ) )
)