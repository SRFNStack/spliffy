module.exports = {
    GET: () => ( {
        headers: {
            'content-type': 'text/html'
        },
        body: `
    <html>
    <body>
    <marquee scrollamount="30">There's no place like home!</marquee>
    </body>
    </html>
    `
    } )
}