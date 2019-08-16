const serverConfig = require( './serverConfig' )
const acme = require( 'acme-client' )
const routes = require( './routes' )

//Clone of https://github.com/publishlab/node-acme-client/blob/master/src/auto.js, but only sets up the http-01 challenge
const setup = async( client, opts ) => {
    console.log("Setting up let's encrypt ssl certificates...")
    const accountPayload = { termsOfServiceAgreed: opts.termsOfServiceAgreed }

    if( opts.email ) {
        accountPayload.contact = [ `mailto:${opts.email}` ]
    }

    try {
        client.getAccountUrl()
    } catch(e) {
        await client.createAccount( accountPayload )
    }

    const csrDomains = await acme.forge.readCsrDomains( opts.csr )
    const domains = [ csrDomains.commonName ].concat( csrDomains.altNames )
    const orderPayload = { identifiers: domains.map( d => ( { type: 'dns', value: d } ) ) }
    const order = await client.createOrder( orderPayload )
    const authorizations = await client.getAuthorizations( order )
    const challengePromises = authorizations.map( async( authz ) => {
        const d = authz.identifier.value

        /* Select challenge based on priority */
        const challenge = authz.challenges.filter( a => a.type === 'http-01' ).slice(0,1)[0]

        if( !challenge ) {
            throw new Error( `Unable to select challenge for ${d}, no challenge found` )
        }

        const keyAuthorization = await client.getChallengeKeyAuthorization( challenge )

        try {
            serverConfig.current.ssl.letsEncrypt.challenge = challenge
            serverConfig.current.ssl.letsEncrypt.keyAuthorization = keyAuthorization
            await client.verifyChallenge( authz, challenge )
            await client.completeChallenge( challenge )
            await client.waitForValidStatus( challenge )
        } finally {
            serverConfig.current.ssl.letsEncrypt.challenge = null
            serverConfig.current.ssl.letsEncrypt.keyAuthorization = null
        }
    } )

    await Promise.all( challengePromises )

    await client.finalizeOrder( order, opts.csr )
    serverConfig.current.ssl.certificateData = await client.getCertificate( order )
    console.log("Let's encrypt certificates created!")

}

module.exports = {
    async init() {
        if( !serverConfig.current.ssl.letsEncrypt.termsOfServiceAgreed )
            throw 'you must agree to terms of service. Set termsOfServiceAgreed to use letsEncrypt'
        if( !serverConfig.current.ssl.letsEncrypt.domains
            || !Array.isArray( serverConfig.current.ssl.letsEncrypt.domains )
            || serverConfig.current.ssl.letsEncrypt.domains.length < 1
        )
            throw 'you must supply a array of at least one domains to get lets encrypt certs for'
        if( serverConfig.current.ssl.port !== 443 || serverConfig.current.port !== 80)
            throw 'The port and ssl.port must be set to 80 and 443 in order to use let\'s encrypt. https://community.letsencrypt.org/t/support-for-ports-other-than-80-and-443-v3/63770/11'
        if( !serverConfig.current.ssl.letsEncrypt.termsOfServiceAgreed )
            throw 'must agree to terms of service. Set termsOfServiceAgreed to use letsEncrypt'
        serverConfig.current.ssl.letsEncrypt.domains.forEach( d => {
            if( d.startsWith( '*' ) ) {
                throw 'wildcard domains are not supported because they require dns verification'
            }
        } )
        if( ![ 'staging', 'production' ].includes( serverConfig.current.ssl.letsEncrypt.directory ) ) throw `letsEncrypt.directory must be either 'staging' or 'production'. These map to require('acme-client').directory.letsencrypt`
        if( !serverConfig.current.ssl.letsEncrypt.privateKey ) {
            serverConfig.current.ssl.letsEncrypt.privateKey = await acme.forge.createPrivateKey()
        }
        if( !serverConfig.current.ssl.letsEncrypt.csr ) {
            let config = {
                commonName: serverConfig.current.ssl.letsEncrypt.domains.slice(0,1)[0]
            }
            if(serverConfig.current.ssl.letsEncrypt.domains.length > 1) {
                config.altNames = serverConfig.current.ssl.letsEncrypt.domains.slice(1)
            }
            const [ key, genCsr ] = await acme.forge.createCsr( config )
            serverConfig.current.ssl.letsEncrypt.csr = genCsr
            serverConfig.current.ssl.keyData = key
        }
        await setup(new acme.Client( {
                                   directoryUrl: acme.directory.letsencrypt[serverConfig.current.ssl.letsEncrypt.directory],
                                   accountKey: serverConfig.current.ssl.letsEncrypt.privateKey
                               } )
            ,
                {
                    csr: serverConfig.current.ssl.letsEncrypt.csr,
                    termsOfServiceAgreed: serverConfig.current.ssl.letsEncrypt.termsOfServiceAgreed
                }
            )
    }
}