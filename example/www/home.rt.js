const marquee = require( '../templates/marquee' )
const { performShenanigans } = require( './externalModule.js' )

module.exports = {
    GET: () => {
        performShenanigans()
        return {
            headers: {
                'content-type':
                    'text/html'
            },
            body: `
                <html>
                    <body>
                    ${marquee( 'shenanigans', 10 ) || ''}
                    </body>
                </html>
                `
        }
    }
}
