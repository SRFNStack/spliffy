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
                        li( 'gorillaGlue.rt.js' ),
                        li( 'blueDream.rt.js' ),
                        li( 'indica',
                            ul(
                                li( 'index.rt.js' )
                            )
                        ),
                        li( 'sativa',
                            ul(
                                li( 'index.rt.js' ),
                                li( 'smokeit.rt.js' )
                            )
                        ),
                        li( 'index.rt.js' )
                    )
                )
            )
        )
    ),
    p( 'This would create the following route mappings:' ),
    ul(
        li( '/strains/ > /www/strains/index.js' ),
        li( '/strains/gorillaGlue > /www/strains/gorillaGlue.rt.js' ),
        li( '/strains/blueDream > /www/strains/blueDream.rt.js' ),
        li( '/strains/indica/ > /www/strains/indica/index.rt.js' ),
        li( '/strains/sativa/ > /www/strains/sativa/index.rt.js' ),
        li( '/strains/sativa/smokeit > /www/strains/sativa/smokeit.rt.js' )
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
    p( '**You can only have on variable file/folder within any given folder. This is because it would be ambiguous which one to use and thus the result couldn\'t be defined. ' ),


    h3( { id: 'catchall-path' }, 'Catchall path' ),
    p( 'You can make a handler handle all requests that start with the given path by appending a + to the file or folder name.' ),
    p( 'Example dir:' ),
    ul(
        li( 'www',
            ul(
                li( 'strains+.rt.js' )
            )
        )
    ),
    p( 'would handle:' ),
    ul(
        li( '/www/strains/gorillaGlue/info/something/more/stuff' ),
        li( '/www/strains/blueDream/dankness/allOfIt' )
    ),
    //TODO update docs for middleware
    //create a .mw.js file in any folder, export a middleware property, and it applies to the folder it's in and everything below it.
    // export a middleware property from any .rt.js file to only apply it to that file.
    // set middleware in the app config to apply to the entire app.
    // middleware receives same arguments as express middleware: req, res, next
    //
    // export a middleware: array property to apply middleware to all methods
    // export a middleware: object property to only apply middleware to specified methods
)
