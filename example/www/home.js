const marquee = require( '../templates/marquee' )

module.exports = {
    GET: ({variant}) => ( {
        headers: {
            'content-type': 'text/html'
        },
        body: `
    <html>
    <body>
    ${marquee( 'javascript templating, no shenanigans!!' , 5)}
    ${variant === "shenanigans" && marquee( 'maybe a little shenanigans',  10) || ""}
    </body>
    </html>
    `
    } ),
}
